import { ethers } from "hardhat";

async function main() {
  // Deploy
  const pool = await ethers.deployContract("TMMVGNFT", []);
  await pool.waitForDeployment();
  const poolAddress = pool.target;
  console.log(`TMMVGNFT deployed to ${poolAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
