import { ethers } from 'hardhat'

async function main() {
  // Deploy
  const nft721 = await ethers.deployContract('Nft721', ['NFT721', 'TMMVG_NFT721'])
  const nft1155 = await ethers.deployContract('Nft1155', ['TMMVG_NFT1155'])
  await nft721.waitForDeployment()
  await nft1155.waitForDeployment()
  console.log(`TMMVG_NFT721 deployed to ${nft721.target}`)
  console.log(`TMMVG_NFT1155 deployed to ${nft1155.target}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
