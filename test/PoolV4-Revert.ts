import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { DeployArgs, deploy } from './util/deploy'

describe('PoolV4-Revert', function () {
  describe('Deployment', function () {
    it('Revert if startTs > endTs', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start - 10
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingToken: ethers.ZeroAddress
      }

      await expect(deploy(deployArgs)).to.be.revertedWith(
        'Invalid start/end Timestamp'
      )
    })

    it('Revert if startTs > endTs', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 10
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingToken: ethers.ZeroAddress
      }

      await expect(deploy(deployArgs)).to.be.revertedWith(
        'At least one of the stakingToken or stakingNft721 or stakingNft1155 must be non-zero address'
      )
    })
  })
  describe('addRewards', function () {
    it('Revert if pool is ended', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      await time.increaseTo(end + 10)
      const { poolV4, stakingToken, rewardToken } = await deploy(deployArgs)
      await expect(
        poolV4.addRewards(ethers.parseEther('40'))
      ).to.be.revertedWith('Pool is ended')
    })
    it('Revert if amount <= 0', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      const { poolV4, stakingToken, rewardToken } = await deploy(deployArgs)
      await expect(
        poolV4.addRewards(ethers.parseEther('0'))
      ).to.be.revertedWith('Amount must be greater than 0')
    })

    it('Revert if amount <= 0', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      const { poolV4, stakingToken, rewardToken } = await deploy(deployArgs)
      await expect(
        poolV4.addRewards(ethers.parseEther('0'))
      ).to.be.revertedWith('Amount must be greater than 0')
    })

    it('Revert if too large amount', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      const { poolV4, stakingToken, rewardToken } = await deploy(deployArgs)
      await expect(
        poolV4.addRewards(
          ethers.parseEther(
            '115792089237316195423570985008687907853269984665640564039458'
          )
        )
      ).to.be.rejectedWith(/value out/)
    })
  })

  describe('depositToken', function () {
    it('Revert if staking is not opened', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.depositToken(1)).to.revertedWith('Pool is not open')
    })
    it('Revert if staking token is zero address', async () => {
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingToken: ethers.ZeroAddress,
        _stakingNft721: await nft721.getAddress()
      }

      await time.increaseTo(start + 10)

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.depositToken(1)).to.be.revertedWith(
        'Token is not supported'
      )
    })

    it('Revert if staking amount <= 0', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      await time.increaseTo(start + 10)

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.depositToken(0)).to.be.revertedWith(
        'Cannot deposit 0 tokens'
      )
    })

    it('Revert if 721 is not staked', async () => {
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingNft721: await nft721.getAddress()
      }

      await time.increaseTo(start + 10)

      const { poolV4, A } = await deploy(deployArgs)
      await expect(poolV4.connect(A).depositToken(1)).to.be.revertedWith(
        'NFT-721 is not staked.'
      )
    })

    it('Revert if 1155 is not staked', async () => {
      const Nft1155 = await ethers.getContractFactory('Nft1155')
      const nft1155 = await Nft1155.deploy('test')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingNft1155: await nft1155.getAddress(),
        _stakingNft1155Id: 1
      }

      await time.increaseTo(start + 10)

      const { poolV4, A } = await deploy(deployArgs)
      await expect(poolV4.connect(A).depositToken(1)).to.be.revertedWith(
        'NFT-1155 is not staked.'
      )
    })

    it('Revert if pool limit exceeded', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _config: [10, 0, 0, 0] // tMax, nMax, tMin, nMin
      }

      await time.increaseTo(start + 10)

      const { poolV4, A, B } = await deploy(deployArgs)
      await poolV4.connect(A).depositToken(5)
      await expect(poolV4.connect(B).depositToken(6)).to.be.revertedWith(
        'Pool limit exceeded (maximum)'
      )
    })

    it('Revert if pool limit minimum', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _config: [0, 0, 10, 0] // tMax, nMax, tMin, nMin
      }

      await time.increaseTo(start + 10)

      const { poolV4, A, B } = await deploy(deployArgs)
      await poolV4.connect(A).depositToken(10)
      await expect(poolV4.connect(B).depositToken(9)).to.be.revertedWith(
        'User limit exceeded (minimum)'
      )
    })
  })

  describe('withdrawToken', function () {
    it('Revert if token is not supported', async () => {
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingToken: ethers.ZeroAddress,
        _stakingNft721: await nft721.getAddress()
      }

      await time.increaseTo(start + 50)

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.withdrawToken(1)).to.be.revertedWith(
        'Token is not supported'
      )
    })

    it('Revert if amount <= 0', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      await time.increaseTo(start + 50)

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.withdrawToken(0)).to.be.revertedWith(
        'Cannot withdraw 0 tokens'
      )
    })

    it('Revert if withdraw amount exceeds staked amount', async() => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      await time.increaseTo(start + 50)

      const { poolV4, A } = await deploy(deployArgs)
      await expect(poolV4.connect(A).withdrawToken(1)).to.be.revertedWith(
        'Withdraw amount exceeds staked amount'
      )
    })
  })

  describe('depositNft721', function () {
    it('Revert if NFT-721 is not supported', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      await time.increaseTo(start + 10)

      const { poolV4 } = await deploy(deployArgs)
      await expect(poolV4.depositNft721(1)).to.be.revertedWith(
        'NFT-721 is not supported'
      )
    })

    it('Revert if NFT is not owned by the user', async () => {
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingNft721: await nft721.getAddress()
      }

      await time.increaseTo(start + 10)

      const { poolV4, A } = await deploy(deployArgs)
      await expect(poolV4.connect(A).depositNft721(1)).to.be.revertedWith(
        'NFT is not owned by the user'
      )
    })

    it('Revert if NFT Pool limit exceeded (maximum)', async () => {
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingNft721: await nft721.getAddress(),
        _config: [0, 1, 0, 0] // tMax, nMax, tMin, nMin
      }

      const { poolV4, owner, A, B } = await deploy(deployArgs)
      await nft721.connect(owner).approve(A.address, 1)
      await nft721.connect(owner).transferFrom(owner.address, A.address, 1)
      await nft721.connect(owner).approve(B.address, 2)
      await nft721.connect(owner).transferFrom(owner.address, B.address, 2)

      await time.increaseTo(start + 10)

      const poolAddress = await poolV4.getAddress()
      await nft721.connect(A).approve(poolAddress, 1)
      await poolV4.connect(A).depositNft721(1)
      await nft721.connect(B).approve(poolAddress, 2)
      await expect(poolV4.connect(B).depositNft721(2)).to.be.revertedWith(
        'Pool limit exceeded (maximum)'
      )
    })
  })

  describe('withdrawNft721', function () {
    it('Revert if NFT-721 is not supported', async () => {
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs = {
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end
      }

      const { poolV4 } = await deploy(deployArgs)
      await time.increaseTo(end + 10)
      await expect(poolV4.withdrawNft721(1)).to.be.revertedWith(
        'NFT-721 is not supported'
      )
    })

    it('Revert if NFT-721 is not staked', async () =>{
      const Nft721 = await ethers.getContractFactory('Nft721')
      const nft721 = await Nft721.deploy('Nft721', 'gold')
      const start = (await time.latest()) + 30 // 30s
      const end = start + 40
      const deployArgs: DeployArgs ={
        _name: 'PoolV4',
        _startTs: start,
        _endTs: end,
        _withdrawEnableTs: end,
        _stakingNft721: await nft721.getAddress()
      }

      const { poolV4, owner, A } = await deploy(deployArgs)

      await time.increaseTo(end + 10)
      await expect(poolV4.connect(A).withdrawNft721(1)).to.be.revertedWith(
        'NFT-721 is not staked'
      )
    })
  })
})
