import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { DeployArgs, deploy } from './util/deploy'

describe('PoolV4-OnlyNft721', function () {
  async function deployOnlyNft721() {
    const Nft721 = await ethers.getContractFactory('Nft721')
    const nft721 = await Nft721.deploy('TMMVG_NFT721', 'gold')

    const start = (await time.latest()) + 30 // 30s
    const end = start + 40 // 40s
    const deployArgs: DeployArgs = {
      _name: 'PoolV4',
      _startTs: start,
      _endTs: end,
      _withdrawEnableTs: end,
      _stakingToken: ethers.ZeroAddress,
      _stakingNft721: await nft721.getAddress(),
      _sharePerNft: 1
    }

    const { poolV4, stakingToken, rewardToken, owner, A, B, C, D } =
      await deploy(deployArgs)

    const poolAddress = await poolV4.getAddress()

    await nft721.connect(owner).transferFrom(owner.address, A.address, 1)
    await nft721.connect(owner).transferFrom(owner.address, B.address, 2)
    await nft721.connect(owner).transferFrom(owner.address, C.address, 3)
    await nft721.connect(A).approve(poolAddress, 1)
    await nft721.connect(B).approve(poolAddress, 2)
    await nft721.connect(C).approve(poolAddress, 3)

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
      nft721
    }
  }

  describe('Deployment', function () {
    it('Should set the right parameters', async function () {
      const { poolV4, deployArgs } = await loadFixture(deployOnlyNft721)
      expect(await poolV4.name()).to.equal(deployArgs._name)
      expect(await poolV4.startTs()).to.equal(deployArgs._startTs)
      expect(await poolV4.endTs()).to.equal(deployArgs._endTs)
      expect(await poolV4.withdrawEnableTs()).to.equal(
        deployArgs._withdrawEnableTs
      )
      expect(await poolV4.stakingToken()).to.equal(deployArgs._stakingToken)
      expect(await poolV4.stakingNft721()).to.equal(deployArgs._stakingNft721)
    })
  })
  it('R = 40, F = 40 / A[0, 1ea], B[0, 1ea], C[0, 1ea]', async function () {
    const {
      poolV4,
      nft721,
      deployArgs,
      stakingToken,
      rewardToken,
      rewardAmount,
      A,
      B,
      C
    } = await loadFixture(deployOnlyNft721)

    await time.increaseTo(deployArgs._startTs)
    const poolAddress = await poolV4.getAddress()
    await poolV4.connect(A).depositNft721(1)
    await poolV4.connect(B).depositNft721(2)
    await poolV4.connect(C).depositNft721(3)

    await time.increaseTo(deployArgs._endTs + 10)

    expect(await poolV4.calcPendingRewards(A.address))
      .to.equal(await poolV4.calcPendingRewards(B.address))
      .to.equal(await poolV4.calcPendingRewards(C.address))
  })
  it('R = 40, F = 40 / A[0, 1ea], B[10, 1ea], C[30, 1ea]', async function () {
    const {
      poolV4,
      nft721,
      deployArgs,
      stakingToken,
      rewardToken,
      rewardAmount,
      A,
      B,
      C
    } = await loadFixture(deployOnlyNft721)

    await time.increaseTo(deployArgs._startTs)
    const poolAddress = await poolV4.getAddress()
    await poolV4.connect(A).depositNft721(1)

    await time.increaseTo(deployArgs._startTs + 10)
    await poolV4.connect(B).depositNft721(2)
    await time.increaseTo(deployArgs._startTs + 30)
    await poolV4.connect(C).depositNft721(3)

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
