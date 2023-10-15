import {
  loadFixture,
  time
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { DeployArgs, SimulateDataArgs, deploy, test } from './util/deploy'

describe('PoolV4-y', function () {
  async function deployLocked() {
    const start = (await time.latest()) + 30 // 30s
    const end = start + 40 // 40s
    const deployArgs: DeployArgs = {
      _name: 'PoolV4',
      _startTs: start,
      _endTs: end,
      _withdrawEnableTs: end
    }

    const { poolV4, stakingToken, rewardToken, owner, A, B, C, D } =
      await deploy(deployArgs)

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
      D
    }
  }

  describe('Deployment', function () {
    it('Should set the right parameters', async function () {
      const { poolV4, deployArgs } = await loadFixture(deployLocked)
      expect(await poolV4.name()).to.equal(deployArgs._name)
      expect(await poolV4.startTs()).to.equal(deployArgs._startTs)
      expect(await poolV4.endTs()).to.equal(deployArgs._endTs)
      expect(await poolV4.withdrawEnableTs()).to.equal(
        deployArgs._withdrawEnableTs
      )
    })
  })
  describe('Staking Reward', function () {
    describe('Locked', function () {
      it('Can not claim before end', async function () {
        // TODO:
      })
      it('R = 40, F = 40 / A[0, 100], B[10, 100], C[30, 100]', async function () {
        const {
          poolV4,
          deployArgs,
          stakingToken,
          rewardToken,
          rewardAmount,
          A,
          B,
          C
        } = await loadFixture(deployLocked)

        const start = deployArgs._startTs
        const end = deployArgs._endTs

        const data: SimulateDataArgs = {
          pool: {
            start,
            end,
            totalReward: rewardAmount
          },
          stakings: [
            {
              wallet: A,
              start: 0,
              end: end - start,
              amount: 100
            },
            {
              wallet: B,
              start: 10,
              end: end - start,
              amount: 100
            },
            {
              wallet: C,
              start: 30,
              end: end - start,
              amount: 100
            }
          ]
        }

        await test(poolV4, rewardToken, data)
      })

      // it ('R = 200, F = 100 / A[10, 50], B[30, 100], A[50, 100]', async function () {
      //   const end = 100
      //   const totalReward = 200
      //   const simulatedRewards = simulateReward({
      //     pool: {
      //       start: 0,
      //       end,
      //       totalReward
      //     },
      //     stakings: [
      //       {
      //         address: 'A',
      //         start: 10,
      //         end,
      //         amount: 50
      //       },
      //       {
      //         address: 'B',
      //         start: 30,
      //         end,
      //         amount: 100
      //       },
      //       {
      //         address: 'A',
      //         start: 50,
      //         end,
      //         amount: 100
      //       }
      //     ]
      //   })
      //   console.log(simulatedRewards)
      // })
    })
  })
})
