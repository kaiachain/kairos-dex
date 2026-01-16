/**
 * Router Setup Utilities
 * Following execute-swap-sdk.js pattern for Smart Order Router setup
 */

import { Token, CurrencyAmount, ChainId } from '@uniswap/sdk-core';
import { Provider } from '@ethersproject/providers';
import state from '../state.json';

// Backward compatibility: TokenAmount -> CurrencyAmount
export function TokenAmount(token: Token, rawAmount: string | bigint) {
  return CurrencyAmount.fromRawAmount(token, rawAmount.toString());
}

// Add 'raw' property for backward compatibility
if (!(CurrencyAmount.prototype as any).raw) {
  Object.defineProperty(CurrencyAmount.prototype, 'raw', {
    get: function() { return this.quotient },
    enumerable: true,
    configurable: true
  });
}

/**
 * Setup router patches for KAIA chain
 * Following execute-swap-sdk.js setupRouterPatches function
 */
export function setupRouterPatches(
  chainId: number,
  WKAIA_TOKEN: Token,
  USDT_TOKEN: Token
) {
  try {
    const chainsUtil = require('@uniswap/smart-order-router/build/main/util/chains');
    const addressesUtil = require('@uniswap/smart-order-router/build/main/util/addresses');
    const configUtil = require('@uniswap/smart-order-router/build/main/routers/alpha-router/config');
    const gasModelUtil = require('@uniswap/smart-order-router/build/main/routers/alpha-router/gas-models/gas-model');
    
    // Patch chain ID mapping
    const originalIDToChainId = chainsUtil.ID_TO_CHAIN_ID;
    const originalIDToNetworkName = chainsUtil.ID_TO_NETWORK_NAME;
    chainsUtil.ID_TO_CHAIN_ID = (id: number) => id === 1001 ? ChainId.MAINNET : originalIDToChainId(id);
    chainsUtil.ID_TO_NETWORK_NAME = (id: number) => id === 1001 ? 'mainnet' : originalIDToNetworkName(id);
    
    // Patch routing config - optimize for speed
    const originalDefaultRoutingConfig = configUtil.DEFAULT_ROUTING_CONFIG_BY_CHAIN;
    configUtil.DEFAULT_ROUTING_CONFIG_BY_CHAIN = (chainId: number) => {
      const config = originalDefaultRoutingConfig(chainId === 1001 ? ChainId.MAINNET : chainId);
      if (config) {
        return { 
          ...config, 
          distributionPercent: +config.distributionPercent || 5,
          // Allow up to 4 hops for multi-hop routes (e.g., USDT -> WKAIA -> MTK -> YTK)
          maxSwapsPerPath: 4, // Increased to 4 hops to support complex multi-hop routes
          maxSplits: 1, // Reduce splits for speed
        };
      }
      return config;
    };
    
    // Patch factory and quoter addresses
    const factoryAddress = state.v3CoreFactoryAddress;
    const quoterV2Address = state.quoterV2Address;
    if (!addressesUtil.V3_CORE_FACTORY_ADDRESSES) addressesUtil.V3_CORE_FACTORY_ADDRESSES = {};
    if (!addressesUtil.QUOTER_V2_ADDRESSES) addressesUtil.QUOTER_V2_ADDRESSES = {};
    if (!addressesUtil.NEW_QUOTER_V2_ADDRESSES) addressesUtil.NEW_QUOTER_V2_ADDRESSES = {};
    
    addressesUtil.V3_CORE_FACTORY_ADDRESSES[ChainId.MAINNET] = factoryAddress;
    addressesUtil.QUOTER_V2_ADDRESSES[ChainId.MAINNET] = quoterV2Address;
    addressesUtil.NEW_QUOTER_V2_ADDRESSES[ChainId.MAINNET] = quoterV2Address;
    
    // Patch wrapped native currency
    if (!chainsUtil.WRAPPED_NATIVE_CURRENCY) chainsUtil.WRAPPED_NATIVE_CURRENCY = {};
    chainsUtil.WRAPPED_NATIVE_CURRENCY[chainId] = WKAIA_TOKEN;
    chainsUtil.WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET] = WKAIA_TOKEN;
    
    // Patch USD gas tokens
    if (!gasModelUtil.usdGasTokensByChain) gasModelUtil.usdGasTokensByChain = {};
    gasModelUtil.usdGasTokensByChain[chainId] = [USDT_TOKEN];
    if (!gasModelUtil.usdGasTokensByChain[ChainId.MAINNET]) {
      gasModelUtil.usdGasTokensByChain[ChainId.MAINNET] = [];
    }
    gasModelUtil.usdGasTokensByChain[ChainId.MAINNET] = [USDT_TOKEN, ...gasModelUtil.usdGasTokensByChain[ChainId.MAINNET]];
    
    // Token lists are now handled by webpack alias (token-lists-stub.js)
    // This prevents DAI_OPTIMISM_SEPOLIA and other chain-specific token errors
  } catch (error) {
    console.warn('Failed to setup router patches:', error);
  }
}

/**
 * Patch Token.equals to handle symbol mismatches
 * Following execute-swap-sdk.js patchTokenEquals function
 */
export function patchTokenEquals() {
  try {
    const TokenClass = require('@uniswap/sdk-core').Token;
    const originalTokenEquals = TokenClass.prototype.equals;
    TokenClass.prototype.equals = function(other: any) {
      if (!other || !this || !other.chainId || !this.chainId) return false;
      if (other.isToken === false) return false;
      
      const thisAddr = this.address?.toLowerCase();
      const otherAddr = other.address?.toLowerCase();
      if (thisAddr && otherAddr && thisAddr === otherAddr && 
          this.chainId === other.chainId && this.decimals === other.decimals) {
        return true;
      }
      return originalTokenEquals.call(this, other);
    };
  } catch (error) {
    console.warn('Failed to patch Token.equals:', error);
  }
}

/**
 * Patch CurrencyAmount methods
 * Following execute-swap-sdk.js patchCurrencyAmount function
 */
export function patchCurrencyAmount() {
  try {
    const TokenAmountClass = require('@uniswap/sdk-core').CurrencyAmount;
    
    // Patch subtract
    const originalSubtract = TokenAmountClass.prototype.subtract;
    TokenAmountClass.prototype.subtract = function(other: any) {
      if (!this?.currency || !other?.currency) {
        const fallbackCurrency = this?.currency || other?.currency;
        if (!fallbackCurrency) return this;
        return new TokenAmountClass(fallbackCurrency, '0');
      }
      if (!this.currency.equals(other.currency)) {
        return new TokenAmountClass(this.currency, '0');
      }
      return originalSubtract.call(this, other);
    };
    
    // Patch divide
    const originalDivide = TokenAmountClass.prototype.divide;
    TokenAmountClass.prototype.divide = function(other: any) {
      const isJSBI = other?.constructor?.name === 'JSBI';
      const isValidDivisor = typeof other === 'number' || typeof other === 'string' || isJSBI;
      if (other && typeof other === 'object' && !isValidDivisor) {
        return this;
      }
      try {
        return originalDivide.call(this, other);
      } catch (error) {
        return this;
      }
    };
  } catch (error) {
    console.warn('Failed to patch CurrencyAmount:', error);
  }
}

/**
 * Create custom multicall provider
 * Following execute-swap-sdk.js createMulticallProvider function
 */
export function createMulticallProvider(
  chainId: number,
  provider: Provider,
  multicallAddress: string
) {
  try {
    const { UniswapInterfaceMulticall__factory } = require('@uniswap/smart-order-router/build/main/types/v3/factories/UniswapInterfaceMulticall__factory');
    const IMulticallProvider = require('@uniswap/smart-order-router/build/main/providers/multicall-provider').IMulticallProvider;
    const lodash = require('lodash');
    const { ethers } = require('ethers');
    
    class CustomMulticallProvider extends IMulticallProvider {
      public chainId: number;
      provider: Provider;
      gasLimitPerCall: number;
      multicallContract: any;
      
      constructor(chainId: number, provider: Provider, multicallAddress: string, gasLimitPerCall = 5000000) {
        super();
        this.chainId = chainId;
        this.provider = provider;
        this.gasLimitPerCall = gasLimitPerCall;
        this.multicallContract = UniswapInterfaceMulticall__factory.connect(multicallAddress, provider);
      }
      
      async callSameFunctionOnMultipleContracts(params: any) {
        const { addresses, contractInterface, functionName, functionParams, providerConfig } = params;
        const fragment = contractInterface.getFunction(functionName);
        const callData = contractInterface.encodeFunctionData(fragment, functionParams);
        const calls = lodash.map(addresses, (address: string) => ({
          target: address,
          callData,
          gasLimit: this.gasLimitPerCall,
        }));
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls, {
          blockTag: providerConfig?.blockNumber,
        });
        const results = aggregateResults.map(({ success, returnData }: any) => ({
          success: success && returnData.length > 2,
          result: success && returnData.length > 2 
            ? contractInterface.decodeFunctionResult(fragment, returnData)
            : null,
        }));
        return { blockNumber, results };
      }
      
      async callSameFunctionOnContractWithMultipleParams(params: any) {
        const { address, contractInterface, functionName, functionParams, additionalConfig, providerConfig } = params;
        const fragment = contractInterface.getFunction(functionName);
        const gasLimitPerCall = additionalConfig?.gasLimitPerCallOverride || this.gasLimitPerCall;
        const calls = lodash.map(functionParams, (functionParam: any) => ({
          target: address,
          callData: contractInterface.encodeFunctionData(fragment, functionParam),
          gasLimit: gasLimitPerCall,
        }));
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls);
        const results = aggregateResults.map(({ success, returnData }: any) => {
          if (!success || returnData.length <= 2) {
            return { success: false, returnData };
          }
          try {
            return {
              success: true,
              result: contractInterface.decodeFunctionResult(fragment, returnData),
            };
          } catch (e) {
            return { success: false, returnData };
          }
        });
        return { blockNumber, results };
      }
      
      async callMultipleFunctionsOnSameContract(params: any) {
        const { address, contractInterface, functionNames, functionParams, additionalConfig } = params;
        const gasLimitPerCall = additionalConfig?.gasLimitPerCallOverride || this.gasLimitPerCall;
        const calls = lodash.map(functionNames, (functionName: string, i: number) => ({
          target: address,
          callData: contractInterface.encodeFunctionData(contractInterface.getFunction(functionName), functionParams?.[i] || []),
          gasLimit: gasLimitPerCall,
        }));
        const { blockNumber, returnData: aggregateResults } = await this.multicallContract.callStatic.multicall(calls);
        const results = aggregateResults.map(({ success, returnData }: any, i: number) => ({
          success: success && returnData.length > 2,
          result: success && returnData.length > 2
            ? contractInterface.decodeFunctionResult(contractInterface.getFunction(functionNames[i]), returnData)
            : null,
        }));
        return { blockNumber, results };
      }
    }
    
    return new CustomMulticallProvider(chainId, provider, multicallAddress, 5000000);
  } catch (error) {
    console.error('Failed to create multicall provider:', error);
    throw error;
  }
}

/**
 * Convert readable amount to raw amount
 * Following execute-swap-sdk.js fromReadableAmount function
 */
export function fromReadableAmount(amount: number, decimals: number): bigint {
  const JSBI = require('jsbi');
  const extraDigits = Math.pow(10, countDecimals(amount));
  const adjustedAmount = amount * extraDigits;
  return JSBI.toNumber(JSBI.divide(
    JSBI.multiply(
      JSBI.BigInt(Math.floor(adjustedAmount)),
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
    ),
    JSBI.BigInt(extraDigits)
  ));
}

function countDecimals(n: number): number {
  if (Math.floor(n) === n) return 0;
  return n.toString().split('.')[1].length || 0;
}

