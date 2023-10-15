import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { AddressLike, BigNumberish } from 'ethers/lib.esm'
import { ethers } from 'hardhat'
import { concat, sortBy } from 'lodash'
import { ERC20, PoolV4 } from '../../typechain-types'
import { simulateReward } from './simulate-reward'

export interface DeployArgs {
  _name: string
  _startTs: number
  _endTs: number
  _withdrawEnableTs: number
  _stakingToken?: AddressLike // default tMMVG Address
  _rewardToken?: AddressLike // default tMMVG2 Address
  _stakingNft721?: AddressLike // default 0
  _stakingNft1155?: AddressLike // default 0
  _stakingNft1155Id?: BigNumberish // default 0
  _sharePerNft?: BigNumberish // default 0
  _rewardsToken?: AddressLike // default tMMVG
  _config?: [BigNumberish, BigNumberish, BigNumberish, BigNumberish] // default [0, 0, 0, 0],
  _whitelist?: AddressLike[] // default []
}

export interface StakingArgs {
  wallet: HardhatEthersSigner
  start: number
  end: number
  amount: number
}

export interface SimulateDataArgs {
  pool: {
    start: number
    end: number
    totalReward: number
  }
  stakings: StakingArgs[]
}

export interface StakingOrClaimData extends StakingArgs {
  side: 'staking' | 'claim'
  time: number
}

export async function test(
  poolV4: PoolV4,
  rewardToken: ERC20,
  simulateData: SimulateDataArgs
) {
  poolV4.on<any>('DepositToken', (wallet, amount) => {
    console.log('on DepositToken')
    console.log(`wallet: ${wallet}`)
    console.log(`amount: ${amount}`)
  })

  poolV4.on<any>('ClaimAllRewards', (wallet, amount) => {
    console.log('on ClaimAllRewards')
    console.log(`wallet: ${wallet}`)
    console.log(`amount: ${amount}`)
    console.log(simulatedRewards[wallet])
  })

  const stakingOrClaimDatas: StakingOrClaimData[] = concat(
    simulateData.stakings.map(s => ({
      ...s,
      side: 'staking',
      time: s.start
    })) as StakingOrClaimData[],
    simulateData.stakings.map(s => ({
      ...s,
      side: 'claim',
      time: s.end
    })) as StakingOrClaimData[]
  )

  const beforeRewardBalances: Record<string, bigint> = {}
  for (const staking of simulateData.stakings) {
    const address = staking.wallet.address
    beforeRewardBalances[address] = await rewardToken.balanceOf(address)
  }
  console.log('Before reward balance', beforeRewardBalances)

  const simulatedRewards = simulateReward(simulateData)
  console.log('simulatedRewards', simulatedRewards)
  const datas = sortBy(stakingOrClaimDatas, d => d.time)

  for (const data of datas) {
    const targetTime = simulateData.pool.start + data.time
    await time.increaseTo(targetTime)
    await time.setNextBlockTimestamp(targetTime)

    if (data.side === 'staking') {
      const stakingAmount = ethers.parseEther(data.amount.toString())
      const tx = await poolV4.connect(data.wallet).depositToken(stakingAmount)
      await tx.wait()

      const issuedTs = Number(await poolV4.lastIssuedTs())
      console.log(
        `Staking time [${data.wallet.address}]: ${issuedTs} (${data.start})`
      )
    } else if (data.side === 'claim') {
      const wallet = data.wallet
      console.log('====== calc rewards before claim ======')
      console.log('wallet', wallet.address)
      const positions = await poolV4.positions(wallet.address)
      const arps = await poolV4.arps()
      const rewardsTokenUnit = await poolV4.rewardsTokenUnit()

      console.log(`arps : ${arps}`)
      console.log(`rewardsTokenUnit : ${rewardsTokenUnit}`)

      const calcPendingRewards = await poolV4.calcPendingRewards(wallet.address)
      console.log(`>> rewards : ${calcPendingRewards}`)
      console.log(`>> simulatedRewards : ${simulatedRewards[wallet.address]}`)
      expect(calcPendingRewards / 100_000n).to.equal(
        ethers.parseEther(simulatedRewards[wallet.address].toString()) /
          100_000n
      )
      const tx = await poolV4.connect(data.wallet).claimAllRewards()
      await tx.wait()

      const issuedTs = Number(await poolV4.lastIssuedTs())
      console.log(
        `Claim time [${data.wallet.address}]: ${issuedTs} (${data.end})`
      )
    }
  }

  await time.increaseTo(simulateData.pool.end + 1000)

  const afterRewardBalances: Record<string, bigint> = {}
  for (const staking of simulateData.stakings) {
    const address = staking.wallet.address
    afterRewardBalances[address] = await rewardToken.balanceOf(address)
  }
  console.log('After reward balance', afterRewardBalances)

  for (const address of Object.keys(afterRewardBalances)) {
    const rewardBalance =
      afterRewardBalances[address] - beforeRewardBalances[address]
    expect(rewardBalance / 100_000n).to.equal(
      ethers.parseEther(simulatedRewards[address].toString()) / 100_000n
    )
  }
}

export async function deploy(deployArgs: DeployArgs) {
  const [owner, A, B, C, D] = await ethers.getSigners()

  const TMMVG = await ethers.getContractFactory('Token')
  const tMMVG = await TMMVG.deploy('TMMVG')
  await tMMVG.waitForDeployment()
  const tMMVGAddress = await tMMVG.getAddress()

  const tMMVG2 = await TMMVG.deploy('TMMVG')
  await tMMVG2.waitForDeployment()
  const tMMVG2Address = await tMMVG2.getAddress()

  await tMMVG.connect(owner).approve(A.address, ethers.MaxUint256)
  await tMMVG.connect(owner).approve(B.address, ethers.MaxUint256)
  await tMMVG.connect(owner).approve(C.address, ethers.MaxUint256)

  // TODO: NFT

  const PoolV4 = await ethers.getContractFactory('PoolV4')
  const poolV4 = await PoolV4.deploy(
    deployArgs._name,
    [deployArgs._startTs, deployArgs._endTs, deployArgs._withdrawEnableTs],
    deployArgs._stakingToken ?? tMMVGAddress,
    deployArgs._stakingNft721 ?? ethers.ZeroAddress,
    deployArgs._stakingNft1155 ?? ethers.ZeroAddress,
    deployArgs._stakingNft1155Id ?? 0,
    deployArgs._sharePerNft ?? 0,
    deployArgs._rewardsToken ?? tMMVG2Address,
    deployArgs._config ?? [0, 0, 0, 0],
    deployArgs._whitelist ?? []
  )

  for (const wallet of [A, B, C, D]) {
    await tMMVG
      .connect(owner)
      .transfer(wallet.address, ethers.parseEther('100000'))
    await tMMVG
      .connect(wallet)
      .approve(await poolV4.getAddress(), ethers.MaxUint256)
  }

  return {
    poolV4,
    deployArgs,
    stakingToken: tMMVG,
    rewardToken: tMMVG2,
    owner,
    A,
    B,
    C,
    D
  }
}
