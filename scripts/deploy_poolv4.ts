import { ethers } from "hardhat";

async function main() {
  //   const deployerAddress = "0x1FB971960ADf0DF521ba1204b7E84b226649A43c";
  const tokenAddress = "0xC81C945BC92644C1E47aCf74B29a0EF18B165890";
  const nftAddress = "0xc7e9Cc3e5274E9E3C484f01b4192aC4378A12b71";

  //   const token = await ethers.getContractAt("ERC20", tokenAddress);
  //   const reward = ethers.parseEther("1000");

  // Deploy
  const pool = await ethers.deployContract("PoolV4", [
    "PoolV4Test",
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    tokenAddress,
    nftAddress,
    1,
    10,
    tokenAddress,
    [0, 0, 0, 0],
    [],
  ]);
  await pool.waitForDeployment();
  const poolAddress = pool.target;
  console.log(`PoolV4 deployed to ${poolAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
