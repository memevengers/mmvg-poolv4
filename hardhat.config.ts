import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import fs from "fs";

const privateKey = fs.readFileSync(".secret.main").toString().trim();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      allowBlocksWithSameTimestamp: true
    },
    sepolia: {
      url: "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
      chainId: 11155111,
      gasPrice: "auto",
      accounts: [privateKey],
    },
    goerli: {
      url: "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 5,
      gasPrice: "auto",
      accounts: [privateKey],
    },
    'bsc-testnet': {
      url: "https://bsc-testnet.publicnode.com",
      chainId: 97,
      gasPrice: "auto",
      accounts: [privateKey],
    }
  },
};

export default config;
