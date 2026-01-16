/**
 * Contract Interaction Abstraction
 * Provides a unified interface for contract interactions
 */

import { Address, PublicClient } from 'viem';
import { Abi } from 'viem';

export interface ContractCallOptions {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

export interface ContractWriteOptions extends ContractCallOptions {
  value?: bigint;
}

/**
 * Contract service for reading from contracts
 */
export class ContractService {
  constructor(private publicClient: PublicClient) {}

  async read<T = any>(options: ContractCallOptions): Promise<T> {
    try {
      return await this.publicClient.readContract({
        address: options.address,
        abi: options.abi,
        functionName: options.functionName,
        args: options.args,
      }) as T;
    } catch (error) {
      console.error('Contract read failed:', error);
      throw new Error(
        `Contract read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async multicall<T = any[]>(calls: ContractCallOptions[]): Promise<T> {
    try {
      const contracts = calls.map(call => ({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
      }));

      return await this.publicClient.multicall({
        contracts,
      }) as T;
    } catch (error) {
      console.error('Multicall failed:', error);
      throw new Error(
        `Multicall failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
