// src/config/web3.js
const { ethers } = require('ethers');
const { constants } = require('./constants');
const logger = require('../utils/logger');

class Web3Service {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.network = null;
    this.isInitialized = false;
    this.gasPrice = null;
    this.gasLimit = 3000000; // Default gas limit
  }

  async initialize() {
    try {
      // Determine network from environment
      const networkName = process.env.NETWORK || 'base';
      const networkConfig = constants.NETWORKS[networkName.toUpperCase()];
      
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${networkName}`);
      }

      this.network = networkConfig;

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      
      // Check network connection
      const network = await this.provider.getNetwork();
      logger.info(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

      // Initialize signer if private key is provided
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        logger.info(`Signer initialized: ${this.signer.address}`);
      }

      // Load contract if address is provided
      if (process.env.CONTRACT_ADDRESS) {
        await this.loadContract();
      }

      // Fetch current gas price
      await this.updateGasPrice();

      // Schedule gas price updates every minute
      setInterval(() => this.updateGasPrice(), 60000);

      this.isInitialized = true;
      logger.info('Web3 service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Web3 service:', error);
      throw error;
    }
  }

  async loadContract() {
    try {
      if (!process.env.CONTRACT_ADDRESS) {
        throw new Error('CONTRACT_ADDRESS environment variable is not set');
      }

      // Load contract ABI
      const contractArtifact = require('../../contracts/artifacts/ClutchBetting.json');
      const contractABI = contractArtifact.abi;

      // Create contract instance
      if (this.signer) {
        this.contract = new ethers.Contract(
          process.env.CONTRACT_ADDRESS,
          contractABI,
          this.signer
        );
      } else {
        this.contract = new ethers.Contract(
          process.env.CONTRACT_ADDRESS,
          contractABI,
          this.provider
        );
      }

      logger.info(`Contract loaded at address: ${process.env.CONTRACT_ADDRESS}`);
      
      // Verify contract is deployed
      const code = await this.provider.getCode(process.env.CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error('No contract code at the specified address');
      }

      // Get contract owner
      try {
        const owner = await this.contract.owner();
        logger.info(`Contract owner: ${owner}`);
      } catch (error) {
        logger.warn('Could not fetch contract owner, may be a different contract version');
      }

      return this.contract;
    } catch (error) {
      logger.error('Failed to load contract:', error);
      throw error;
    }
  }

  async updateGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      this.gasPrice = feeData.gasPrice;
      
      // Add 10% buffer
      this.gasPrice = this.gasPrice * 110n / 100n;
      
      logger.debug(`Gas price updated: ${ethers.formatUnits(this.gasPrice, 'gwei')} Gwei`);
    } catch (error) {
      logger.error('Failed to update gas price:', error);
    }
  }

  async deployContract(contractBytecode, contractABI, constructorArgs = []) {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized. PRIVATE_KEY environment variable is required for deployment.');
      }

      logger.info('Deploying contract...');
      
      const factory = new ethers.ContractFactory(contractABI, contractBytecode, this.signer);
      
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: this.gasLimit,
        gasPrice: this.gasPrice
      });

      await contract.waitForDeployment();
      const address = await contract.getAddress();
      
      logger.info(`Contract deployed at address: ${address}`);
      logger.info(`Transaction hash: ${contract.deploymentTransaction().hash}`);
      
      return {
        address,
        contract,
        txHash: contract.deploymentTransaction().hash
      };
    } catch (error) {
      logger.error('Contract deployment failed:', error);
      throw error;
    }
  }

  async sendTransaction(to, value, data = '0x') {
    try {
      if (!this.signer) {
        throw new Error('Signer not initialized');
      }

      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(value.toString()),
        data,
        gasLimit: this.gasLimit,
        gasPrice: this.gasPrice
      });

      const receipt = await tx.wait();
      
      logger.info(`Transaction sent: ${tx.hash}`);
      logger.debug('Transaction receipt:', {
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      });

      return {
        txHash: tx.hash,
        receipt
      };
    } catch (error) {
      logger.error('Transaction failed:', error);
      throw error;
    }
  }

  async callContract(method, args = [], options = {}) {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      const contractMethod = this.contract[method];
      if (!contractMethod) {
        throw new Error(`Method ${method} not found in contract`);
      }

      const txOptions = {
        gasLimit: options.gasLimit || this.gasLimit,
        gasPrice: options.gasPrice || this.gasPrice,
        value: options.value ? ethers.parseEther(options.value.toString()) : 0
      };

      let result;
      if (options.readOnly) {
        // Read-only call (no gas needed)
        result = await contractMethod(...args);
      } else {
        // Write transaction
        const tx = await contractMethod(...args, txOptions);
        const receipt = await tx.wait();
        
        result = {
          txHash: tx.hash,
          receipt,
          success: receipt.status === 1
        };
        
        logger.info(`Contract method ${method} called: ${tx.hash}`);
      }

      return result;
    } catch (error) {
      logger.error(`Contract call ${method} failed:`, error);
      throw error;
    }
  }

  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  async getTransactionReceipt(txHash) {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      logger.error(`Failed to get receipt for ${txHash}:`, error);
      throw error;
    }
  }

  async estimateGas(to, value, data) {
    try {
      return await this.provider.estimateGas({
        to,
        value,
        data
      });
    } catch (error) {
      logger.error('Gas estimation failed:', error);
      throw error;
    }
  }

  async getEvents(eventName, filter = {}, fromBlock = 0, toBlock = 'latest') {
    try {
      if (!this.contract) {
        throw new Error('Contract not loaded');
      }

      const events = await this.contract.queryFilter(
        this.contract.filters[eventName](...Object.values(filter)),
        fromBlock,
        toBlock
      );

      return events;
    } catch (error) {
      logger.error(`Failed to get events for ${eventName}:`, error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      const gasPrice = await this.provider.getGasPrice();

      return {
        status: 'healthy',
        network: network.name,
        chainId: network.chainId,
        blockNumber,
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' Gwei',
        isConnected: true,
        contractLoaded: !!this.contract,
        signerAvailable: !!this.signer
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        isConnected: false
      };
    }
  }

  // Utility functions
  formatEther(wei) {
    return ethers.formatEther(wei);
  }

  parseEther(ether) {
    return ethers.parseEther(ether.toString());
  }

  isAddress(address) {
    return ethers.isAddress(address);
  }

  getSignerAddress() {
    return this.signer ? this.signer.address : null;
  }
}

// Create singleton instance
const web3Service = new Web3Service();

module.exports = web3Service;