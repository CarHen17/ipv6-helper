import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  type SubnetData,
  type BlockData,
  type AggregationResult,
  validateIPv6,
  expandIPv6Address,
  shortenIPv6,
  formatIPv6Address,
  ipv6ToBigInt,
  generateSubnets,
  generateIPs,
  calculateGateway,
  canAggregateBlocks,
  compareBlocks,
  findSubnetForIP,
  buildBlocksFromIndices,
  IPV6_CONFIG,
  type ComparisonResult,
} from '@/lib/ipv6-utils';

export interface HistoryEntry {
  block: string;
  prefix: number;
  timestamp: number;
  subnetCount: number;
}

interface CalculatorState {
  currentStep: number;
  ipv6Input: string;
  mainBlock: BlockData | null;
  mainBlockGateway: string;
  subRedesGeradas: SubnetData[];
  selectedSubnetPrefix: number | null;
  selectedBlock: BlockData | null;
  selectedIndices: Set<number>;
  individualSelectedIndex: number | null;
  isLoading: boolean;
  loadingProgress: number;
  errorMessage: string | null;
  errorSuggestion: string | null;
  displayedCount: number;
  // IP generation
  mainBlockIps: { ip: string; number: number }[];
  mainBlockIpsVisible: boolean;
  subnetIps: { ip: string; number: number }[];
  subnetIpsVisible: boolean;
  subnetIpsBlock: SubnetData | null;
  // Aggregation
  aggregationResult: AggregationResult | null;
  comparisonResult: ComparisonResult | null;
  aggregatedIps: { ip: string; number: number }[];
  aggregatedIpsVisible: boolean;
  // History
  history: HistoryEntry[];
}

interface CalculatorContextType extends CalculatorState {
  setIpv6Input: (val: string) => void;
  calcularSubRedes: () => boolean;
  selecionarPrefixo: (prefix: number, skipConfirm?: boolean) => void;
  getSubnetCount: (prefix: number) => bigint | null;
  resetCalculadora: () => void;
  goBackToStep: (step: number) => void;
  loadMore: () => void;
  toggleSelectAll: () => void;
  toggleSelect: (index: number) => void;
  selectIndividual: (index: number) => void;
  generateMainBlockIps: () => void;
  generateMoreMainBlockIps: () => void;
  resetMainBlockIps: () => void;
  generateSubnetIps: () => void;
  generateMoreSubnetIps: () => void;
  resetSubnetIps: () => void;
  toggleMainBlockIps: () => void;
  toggleAggregatedIps: () => void;
  generateMoreAggregatedIps: () => void;
  resetAggregatedIps: () => void;
  restoreFromHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  reverseSearch: (ip: string) => { found: boolean; subnet?: SubnetData; index?: number; error?: string };
  filterSubnets: (query: string) => SubnetData[];
  sidebarBlock: BlockData | null;
  sidebarGateway: string;
}

const CalculatorContext = createContext<CalculatorContextType | null>(null);

const STORAGE_KEY = 'ipv6calc_history';
const MAX_HISTORY = 20;
const LOAD_BATCH = 100;

function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    console.warn('[IPv6Calc] Falha ao carregar histórico do localStorage:', e);
    return [];
  }
}

function saveHistoryToStorage(history: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('[IPv6Calc] Falha ao salvar histórico no localStorage (quota excedida ou modo privado):', e);
  }
}

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CalculatorState>({
    currentStep: 1,
    ipv6Input: '',
    mainBlock: null,
    mainBlockGateway: '',
    subRedesGeradas: [],
    selectedSubnetPrefix: null,
    selectedBlock: null,
    selectedIndices: new Set(),
    individualSelectedIndex: null,
    isLoading: false,
    loadingProgress: 0,
    errorMessage: null,
    errorSuggestion: null,
    displayedCount: 0,
    mainBlockIps: [],
    mainBlockIpsVisible: false,
    subnetIps: [],
    subnetIpsVisible: false,
    subnetIpsBlock: null,
    aggregationResult: null,
    comparisonResult: null,
    aggregatedIps: [],
    aggregatedIpsVisible: false,
    history: loadHistoryFromStorage(),
  });

  const mainBlockIpOffsetRef = useRef(0);
  const subnetIpOffsetRef = useRef(0);
  const aggregatedIpOffsetRef = useRef(0);
  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (generateTimerRef.current !== null) {
        clearTimeout(generateTimerRef.current);
      }
    };
  }, []);

  const setIpv6Input = useCallback((val: string) => {
    setState(s => ({ ...s, ipv6Input: val, errorMessage: null, errorSuggestion: null }));
  }, []);

  const calcularSubRedes = useCallback((): boolean => {
    const inputValue = state.ipv6Input.trim();
    const errorResult = validateIPv6(inputValue);
    if (errorResult) {
      setState(s => ({ ...s, errorMessage: errorResult.message, errorSuggestion: errorResult.suggestion }));
      return false;
    }

    const parts = inputValue.split('/');
    if (parts.length !== 2 || !parts[1]) {
      setState(s => ({ ...s, errorMessage: 'Formato CIDR inválido', errorSuggestion: null }));
      return false;
    }
    const prefixoNum = parseInt(parts[1]);
    const enderecoCompleto = expandIPv6Address(inputValue);
    if (enderecoCompleto.startsWith("Erro")) {
      setState(s => ({ ...s, errorMessage: enderecoCompleto, errorSuggestion: null }));
      return false;
    }

    const gateway = calculateGateway(enderecoCompleto);

    setState(s => ({
      ...s,
      currentStep: 2,
      mainBlock: { network: enderecoCompleto, prefix: prefixoNum },
      mainBlockGateway: gateway,
      subRedesGeradas: [],
      selectedSubnetPrefix: null,
      selectedBlock: null,
      selectedIndices: new Set(),
      individualSelectedIndex: null,
      displayedCount: 0,
      errorMessage: null,
      errorSuggestion: null,
      mainBlockIps: [],
      mainBlockIpsVisible: false,
      subnetIps: [],
      subnetIpsVisible: false,
      subnetIpsBlock: null,
      aggregationResult: null,
      comparisonResult: null,
      aggregatedIps: [],
      aggregatedIpsVisible: false,
    }));
    mainBlockIpOffsetRef.current = 0;
    subnetIpOffsetRef.current = 0;
    aggregatedIpOffsetRef.current = 0;
    return true;
  }, [state.ipv6Input]);

  const selecionarPrefixo = useCallback((prefix: number, skipConfirm?: boolean) => {
    if (!state.mainBlock) return;

    const { network: enderecoCompleto, prefix: prefixoNum } = state.mainBlock;
    if (prefix <= prefixoNum) return;

    const ipv6BigInt = BigInt("0x" + enderecoCompleto.replace(/:/g, ''));
    const numSubRedes = 1n << BigInt(prefix - prefixoNum);

    if (numSubRedes > IPV6_CONFIG.LARGE_SUBNET_THRESHOLD && !skipConfirm) {
      // Let the view handle confirmation
      return;
    }

    // Cancel any pending generation
    if (generateTimerRef.current !== null) {
      clearTimeout(generateTimerRef.current);
      generateTimerRef.current = null;
    }

    // Capture values before setTimeout to avoid stale closure reads
    const ipv6Input = state.ipv6Input.trim();
    const currentHistory = state.history;

    setState(prev => ({ ...prev, isLoading: true, loadingProgress: 0, currentStep: 3, selectedSubnetPrefix: prefix }));

    generateTimerRef.current = setTimeout(() => {
      try {
        const initialMask = ((1n << BigInt(prefixoNum)) - 1n) << (128n - BigInt(prefixoNum));
        const subnets = generateSubnets(ipv6BigInt, initialMask, prefix, numSubRedes, (percent) => {
          setState(prev => ({ ...prev, loadingProgress: percent }));
        });

        // Add to history
        const newHistory = [...currentHistory];
        const entry: HistoryEntry = {
          block: ipv6Input,
          prefix,
          timestamp: Date.now(),
          subnetCount: subnets.length,
        };
        if (newHistory.length === 0 || newHistory[0].block !== entry.block || newHistory[0].prefix !== entry.prefix) {
          newHistory.unshift(entry);
          if (newHistory.length > MAX_HISTORY) newHistory.splice(MAX_HISTORY);
          saveHistoryToStorage(newHistory);
        }

        setState(prev => ({
          ...prev,
          isLoading: false,
          loadingProgress: 100,
          subRedesGeradas: subnets,
          displayedCount: Math.min(LOAD_BATCH, subnets.length),
          selectedIndices: new Set(),
          individualSelectedIndex: null,
          history: newHistory,
          aggregationResult: null,
          comparisonResult: null,
        }));
      } catch (error) {
        console.error('[IPv6Calc] Erro ao gerar sub-redes:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          loadingProgress: 0,
          errorMessage: 'Erro ao gerar sub-redes. Tente novamente.',
          errorSuggestion: null,
        }));
      } finally {
        generateTimerRef.current = null;
      }
    }, 50);
  }, [state.mainBlock, state.ipv6Input, state.history]);

  const resetCalculadora = useCallback(() => {
    // Cancel any pending generation
    if (generateTimerRef.current !== null) {
      clearTimeout(generateTimerRef.current);
      generateTimerRef.current = null;
    }
    setState(s => ({
      ...s,
      currentStep: 1,
      ipv6Input: '',
      mainBlock: null,
      mainBlockGateway: '',
      subRedesGeradas: [],
      selectedSubnetPrefix: null,
      selectedBlock: null,
      selectedIndices: new Set(),
      individualSelectedIndex: null,
      isLoading: false,
      loadingProgress: 0,
      errorMessage: null,
      errorSuggestion: null,
      displayedCount: 0,
      mainBlockIps: [],
      mainBlockIpsVisible: false,
      subnetIps: [],
      subnetIpsVisible: false,
      subnetIpsBlock: null,
      aggregationResult: null,
      comparisonResult: null,
      aggregatedIps: [],
      aggregatedIpsVisible: false,
    }));
    mainBlockIpOffsetRef.current = 0;
    subnetIpOffsetRef.current = 0;
    aggregatedIpOffsetRef.current = 0;
  }, []);

  const goBackToStep = useCallback((step: number) => {
    setState(s => {
      if (step >= s.currentStep) return s;
      if (step === 1) return s; // use resetCalculadora instead
      if (step === 2) {
        return {
          ...s,
          currentStep: 2,
          subRedesGeradas: [],
          selectedSubnetPrefix: null,
          selectedBlock: null,
          selectedIndices: new Set<number>(),
          individualSelectedIndex: null,
          displayedCount: 0,
          aggregationResult: null,
          comparisonResult: null,
          subnetIps: [],
          subnetIpsVisible: false,
          subnetIpsBlock: null,
          aggregatedIps: [],
          aggregatedIpsVisible: false,
        };
      }
      return s;
    });
  }, []);

  const loadMore = useCallback(() => {
    setState(s => ({
      ...s,
      displayedCount: Math.min(s.displayedCount + LOAD_BATCH, s.subRedesGeradas.length),
    }));
  }, []);

  const computeAggregation = useCallback((newIndices: Set<number>, subRedes: SubnetData[]) => {
    if (newIndices.size < 2) {
      return { aggregationResult: null, comparisonResult: null };
    }
    const blocks = buildBlocksFromIndices(subRedes, newIndices);
    const result = canAggregateBlocks(blocks);
    const comparison: ComparisonResult | null = !result.canAggregate && blocks.length === 2 ? compareBlocks(blocks[0], blocks[1]) : null;
    return { aggregationResult: result, comparisonResult: comparison };
  }, []);

  const toggleSelectAll = useCallback(() => {
    setState(s => {
      const allSelected = s.selectedIndices.size === s.subRedesGeradas.length;
      const newIndices = allSelected ? new Set<number>() : new Set(s.subRedesGeradas.map((_, i) => i));
      const { aggregationResult, comparisonResult } = computeAggregation(newIndices, s.subRedesGeradas);
      return { ...s, selectedIndices: newIndices, individualSelectedIndex: null, aggregationResult, comparisonResult };
    });
  }, [computeAggregation]);

  const toggleSelect = useCallback((index: number) => {
    setState(s => {
      const newIndices = new Set(s.selectedIndices);
      if (newIndices.has(index)) newIndices.delete(index);
      else newIndices.add(index);
      const { aggregationResult, comparisonResult } = computeAggregation(newIndices, s.subRedesGeradas);
      return { ...s, selectedIndices: newIndices, aggregationResult, comparisonResult };
    });
  }, [computeAggregation]);

  const selectIndividual = useCallback((index: number) => {
    setState(s => {
      const subnet = s.subRedesGeradas[index];
      if (!subnet) return s;
      const parts = subnet.subnet.split('/');
      if (parts.length !== 2 || !parts[1]) return s;
      return {
        ...s,
        individualSelectedIndex: index,
        selectedBlock: { network: subnet.network, prefix: parseInt(parts[1]), subnet: subnet.subnet, initial: subnet.initial, final: subnet.final, index },
      };
    });
  }, []);

  const generateMainBlockIps = useCallback(() => {
    if (!state.mainBlock) return;
    mainBlockIpOffsetRef.current = 0;
    const ips = generateIPs(state.mainBlock.network, 0, 50);
    mainBlockIpOffsetRef.current = 50;
    setState(s => ({ ...s, mainBlockIps: ips, mainBlockIpsVisible: true }));
  }, [state.mainBlock]);

  const generateMoreMainBlockIps = useCallback(() => {
    if (!state.mainBlock) return;
    const offset = mainBlockIpOffsetRef.current;
    const newIps = generateIPs(state.mainBlock.network, offset, 50);
    mainBlockIpOffsetRef.current = offset + 50;
    setState(s => ({ ...s, mainBlockIps: [...s.mainBlockIps, ...newIps] }));
  }, [state.mainBlock]);

  const resetMainBlockIps = useCallback(() => {
    mainBlockIpOffsetRef.current = 0;
    setState(s => ({ ...s, mainBlockIps: [], mainBlockIpsVisible: false }));
  }, []);

  const toggleMainBlockIps = useCallback(() => {
    setState(s => {
      if (s.mainBlockIpsVisible) {
        return { ...s, mainBlockIpsVisible: false };
      } else {
        if (s.mainBlockIps.length === 0 && s.mainBlock) {
          mainBlockIpOffsetRef.current = 0;
          const ips = generateIPs(s.mainBlock.network, 0, 50);
          mainBlockIpOffsetRef.current = 50;
          return { ...s, mainBlockIps: ips, mainBlockIpsVisible: true };
        }
        return { ...s, mainBlockIpsVisible: true };
      }
    });
  }, []);

  const generateSubnetIps = useCallback(() => {
    const indices = Array.from(state.selectedIndices);
    if (indices.length !== 1) return;
    const subnet = state.subRedesGeradas[indices[0]];
    if (!subnet) return;
    subnetIpOffsetRef.current = 0;
    const ips = generateIPs(subnet.network, 0, 50);
    subnetIpOffsetRef.current = 50;
    setState(s => ({ ...s, subnetIps: ips, subnetIpsVisible: true, subnetIpsBlock: subnet }));
  }, [state.selectedIndices, state.subRedesGeradas]);

  const generateMoreSubnetIps = useCallback(() => {
    if (!state.subnetIpsBlock) return;
    const offset = subnetIpOffsetRef.current;
    const newIps = generateIPs(state.subnetIpsBlock.network, offset, 50);
    subnetIpOffsetRef.current = offset + 50;
    setState(s => ({ ...s, subnetIps: [...s.subnetIps, ...newIps] }));
  }, [state.subnetIpsBlock]);

  const resetSubnetIps = useCallback(() => {
    subnetIpOffsetRef.current = 0;
    setState(s => ({ ...s, subnetIps: [], subnetIpsVisible: false, subnetIpsBlock: null }));
  }, []);

  const toggleAggregatedIps = useCallback(() => {
    setState(s => {
      if (s.aggregatedIpsVisible) {
        return { ...s, aggregatedIpsVisible: false };
      }
      if (s.aggregatedIps.length === 0 && s.aggregationResult?.aggregatedBlock) {
        aggregatedIpOffsetRef.current = 0;
        const ips = generateIPs(s.aggregationResult.aggregatedBlock.network, 0, 50);
        aggregatedIpOffsetRef.current = 50;
        return { ...s, aggregatedIps: ips, aggregatedIpsVisible: true };
      }
      return { ...s, aggregatedIpsVisible: true };
    });
  }, []);

  const generateMoreAggregatedIps = useCallback(() => {
    if (!state.aggregationResult?.aggregatedBlock) return;
    const offset = aggregatedIpOffsetRef.current;
    const newIps = generateIPs(state.aggregationResult.aggregatedBlock.network, offset, 50);
    aggregatedIpOffsetRef.current = offset + 50;
    setState(s => ({ ...s, aggregatedIps: [...s.aggregatedIps, ...newIps] }));
  }, [state.aggregationResult]);

  const resetAggregatedIps = useCallback(() => {
    aggregatedIpOffsetRef.current = 0;
    setState(s => ({ ...s, aggregatedIps: [], aggregatedIpsVisible: false }));
  }, []);

  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setState(s => ({ ...s, ipv6Input: entry.block }));
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[IPv6Calc] Falha ao limpar histórico:', e);
    }
    setState(s => ({ ...s, history: [] }));
  }, []);

  const reverseSearchFn = useCallback((ip: string) => {
    return findSubnetForIP(ip, state.subRedesGeradas);
  }, [state.subRedesGeradas]);

  const filterSubnets = useCallback((query: string): SubnetData[] => {
    if (!query) return state.subRedesGeradas;
    const q = query.toLowerCase();
    return state.subRedesGeradas.filter(s =>
      s.subnet.toLowerCase().includes(q) ||
      s.initial.toLowerCase().includes(q) ||
      s.final.toLowerCase().includes(q) ||
      s.network.toLowerCase().includes(q)
    );
  }, [state.subRedesGeradas]);

  // Compute sidebar block info
  const sidebarBlock = useMemo(() => {
    if (state.individualSelectedIndex === null) return state.mainBlock;
    const subnet = state.subRedesGeradas[state.individualSelectedIndex];
    if (!subnet) return state.mainBlock;
    const parts = subnet.subnet.split('/');
    if (parts.length !== 2 || !parts[1]) return state.mainBlock;
    return { network: subnet.network, prefix: parseInt(parts[1]), subnet: subnet.subnet };
  }, [state.individualSelectedIndex, state.subRedesGeradas, state.mainBlock]);

  const sidebarGateway = useMemo(
    () => (sidebarBlock ? calculateGateway(sidebarBlock.network) : state.mainBlockGateway),
    [sidebarBlock, state.mainBlockGateway]
  );

  const value: CalculatorContextType = {
    ...state,
    setIpv6Input,
    calcularSubRedes,
    selecionarPrefixo,
    getSubnetCount: useCallback((prefix: number) => {
      if (!state.mainBlock) return null;
      const prefixoNum = state.mainBlock.prefix;
      if (prefix <= prefixoNum) return null;
      return 1n << BigInt(prefix - prefixoNum);
    }, [state.mainBlock]),
    resetCalculadora,
    goBackToStep,
    loadMore,
    toggleSelectAll,
    toggleSelect,
    selectIndividual,
    generateMainBlockIps,
    generateMoreMainBlockIps,
    resetMainBlockIps,
    toggleMainBlockIps,
    generateSubnetIps,
    generateMoreSubnetIps,
    resetSubnetIps,
    toggleAggregatedIps,
    generateMoreAggregatedIps,
    resetAggregatedIps,
    restoreFromHistory,
    clearHistory,
    reverseSearch: reverseSearchFn,
    filterSubnets,
    sidebarBlock,
    sidebarGateway,
  };

  return <CalculatorContext.Provider value={value}>{children}</CalculatorContext.Provider>;
}

export function useCalculator() {
  const ctx = useContext(CalculatorContext);
  if (!ctx) throw new Error('useCalculator must be used within CalculatorProvider');
  return ctx;
}
