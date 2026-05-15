export interface PaykitProviderOptions {
  /**
   * Whether to enable debug mode
   */
  debug?: boolean;

  /**
   * Whether to use the sandbox environment
   */
  isSandbox: boolean;
}

export type OverrideProps<T, V> = V & Omit<T, keyof V>;

export type LooseAutoComplete<T extends string> = T | Omit<string, T>;
