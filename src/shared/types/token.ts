export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId?: number;
}

export interface TokenList {
  name: string;
  tokens: Token[];
}

