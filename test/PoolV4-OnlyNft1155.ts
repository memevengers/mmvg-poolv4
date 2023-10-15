import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { DeployArgs, deploy } from './util/deploy'

describe('PoolV4-OnlyNft1155', function () {
  async function deployOnlyNft1155() {
    const Nft1155 = await ethers.getContractFactory('Nft1155')
    const nft1155 = await Nft1155.deploy('TMMVG_NFT1155')

    const start = (await time.latest()) + 30 // 30s
    const end = start + 40 // 40s
    const deployArgs: DeployArgs = {
      _name: 'PoolV4',
      _startTs: start,
      _endTs: end,
      _withdrawEnableTs: end,
      _stakingToken: ethers.ZeroAddress,
      _stakingNft1155: await nft1155.getAddress(),
      _stakingNft1155Id: 1,
      _sharePerNft: 1
    }

    const { poolV4, stakingToken, rewardToken, owner, A, B, C, D } =
      await deploy(deployArgs)

    const poolAddress = await poolV4.getAddress()

    console.log(
      '===================================================================================='
    )
    await nft1155
      .connect(owner)
      .safeTransferFrom(owner.address, A.address, 1, 1, '0x')
    await nft1155
      .connect(owner)
      .safeTransferFrom(owner.address, B.address, 1, 1, '0x')
    await nft1155
      .connect(owner)
      .safeTransferFrom(owner.address, C.address, 1, 1, '0x')
    await nft1155.connect(A).setApprovalForAll(poolAddress, true)
    await nft1155.connect(B).setApprovalForAll(poolAddress, true)
    await nft1155.connect(C).setApprovalForAll(poolAddress, true)

    // reward 40
    const rewardAmount = 40
    await rewardToken.approve(await poolV4.getAddress(), ethers.MaxUint256)
    await poolV4.addRewards(ethers.parseEther(rewardAmount.toString()))

    return {
      poolV4,
      deployArgs,
      stakingToken,
      rewardToken,
      rewardAmount,
      owner,
      A,
      B,
      C,
      D,
      nft1155
    }
  }

  describe('Deployment', function () {
    it('Should set the right parameters', async function () {
      const { poolV4, deployArgs } = await loadFixture(deployOnlyNft1155)
      expect(await poolV4.name()).to.equal(deployArgs._name)
      expect(await poolV4.startTs()).to.equal(deployArgs._startTs)
      expect(await poolV4.endTs()).to.equal(deployArgs._endTs)
      expect(await poolV4.withdrawEnableTs()).to.equal(
        deployArgs._withdrawEnableTs
      )
      expect(await poolV4.stakingToken()).to.equal(deployArgs._stakingToken)
      expect(await poolV4.stakingNft1155()).to.equal(deployArgs._stakingNft1155)
    })
  })
  it('R = 40, F = 40 / A[0, 1ea], B[0, 1ea], C[0, 1ea]', async function () {
    const {
      poolV4,
      nft1155,
      deployArgs,
      stakingToken,
      rewardToken,
      rewardAmount,
      A,
      B,
      C
    } = await loadFixture(deployOnlyNft1155)

    await time.increaseTo(deployArgs._startTs)
    const poolAddress = await poolV4.getAddress()
    await poolV4.connect(A).depositNft1155(1, 1)
    await poolV4.connect(B).depositNft1155(1, 1)
    await poolV4.connect(C).depositNft1155(1, 1)

    await time.increaseTo(deployArgs._endTs + 10)

    expect(await poolV4.calcPendingRewards(A.address))
      .to.equal(await poolV4.calcPendingRewards(B.address))
      .to.equal(await poolV4.calcPendingRewards(C.address))
  })
  it('R = 40, F = 40 / A[0, 1ea], B[10, 1ea], C[30, 1ea]', async function () {
    const {
      poolV4,
      nft1155,
      deployArgs,
      stakingToken,
      rewardToken,
      rewardAmount,
      A,
      B,
      C
    } = await loadFixture(deployOnlyNft1155)

    await time.increaseTo(deployArgs._startTs)
    const poolAddress = await poolV4.getAddress()
    await poolV4.connect(A).depositNft1155(1, 1)

    await time.increaseTo(deployArgs._startTs + 10)
    await poolV4.connect(B).depositNft1155(1, 1)
    await time.increaseTo(deployArgs._startTs + 30)
    await poolV4.connect(C).depositNft1155(1, 1)

    await time.increaseTo(deployArgs._endTs + 10)

    expect(await poolV4.calcPendingRewards(A.address)).to.equal(
      23333333333333333333n
    )
    expect(await poolV4.calcPendingRewards(B.address)).to.equal(
      13333333333333333333n
    )
    expect(await poolV4.calcPendingRewards(C.address)).to.equal(
      3333333333333333333n
    )
  })
})
