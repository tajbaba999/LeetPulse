export type TopicWeight = {
  arrays: number;
  trees: number;
  graphs: number;
  dp: number;
  strings: number;
  greedy: number;
};

export const faangWeights: Record<string, TopicWeight> = {
  google: {
    arrays: 0.15,
    trees: 0.20,
    graphs: 0.25,
    dp: 0.25,
    strings: 0.10,
    greedy: 0.05,
  },
  amazon: {
    arrays: 0.25,
    trees: 0.20,
    graphs: 0.15,
    dp: 0.15,
    strings: 0.15,
    greedy: 0.10,
  },
  meta: {
    arrays: 0.20,
    trees: 0.15,
    graphs: 0.20,
    dp: 0.20,
    strings: 0.15,
    greedy: 0.10,
  },
  microsoft: {
    arrays: 0.20,
    trees: 0.25,
    graphs: 0.15,
    dp: 0.20,
    strings: 0.10,
    greedy: 0.10,
  },
  apple: {
    arrays: 0.25,
    trees: 0.15,
    graphs: 0.10,
    dp: 0.15,
    strings: 0.20,
    greedy: 0.15,
  },
};

export const topicDisplayNames: Record<string, string> = {
  arrays: "Arrays",
  trees: "Trees",
  graphs: "Graphs",
  dp: "DP",
  strings: "Strings",
  greedy: "Greedy",
};
