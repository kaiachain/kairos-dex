// Standard WETH9/WKAIA ABI for wrapping/unwrapping native tokens
export const WKAIA_ABI = [
  {
    constant: false,
    payable: true,
    stateMutability: 'payable',
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
  },
  {
    constant: false,
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'withdraw',
    inputs: [
      {
        name: 'wad',
        type: 'uint256',
      },
    ],
    outputs: [],
  },
  {
    constant: true,
    stateMutability: 'view',
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'account',
        type: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
] as const;

