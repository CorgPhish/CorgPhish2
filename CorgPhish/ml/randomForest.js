export const createRandomForest = (clf) => {
  const createDecisionTree = (root) => {
    const predictOne = (sample) => {
      let node = root;
      while (node && node.type === "split") {
        const [feature, threshold] = node.threshold.split(" <= ");
        const featureValue = sample[feature] ?? 0;
        if (Number(featureValue) <= Number(threshold)) {
          node = node.left;
        } else {
          node = node.right;
        }
      }
      return node?.value?.[0] ?? [0, 0];
    };

    const predict = (samples) => samples.map((sample) => predictOne(sample));

    return { predict, predictOne };
  };

  const predict = (samples) => {
    if (!Array.isArray(clf?.estimators) || !clf.estimators.length) {
      return samples.map(() => [false, 0]);
    }

    const predictionsPerTree = clf.estimators.map((estimator) =>
      createDecisionTree(estimator).predict(samples)
    );

    return samples.map((_, sampleIndex) => {
      let positive = 0;
      let negative = 0;
      predictionsPerTree.forEach((treePredictions) => {
        const [neg, pos] = treePredictions[sampleIndex] ?? [0, 0];
        positive += Number(pos);
        negative += Number(neg);
      });
      const isPhishing = positive >= negative;
      const confidence = Math.max(positive, negative);
      return [isPhishing, confidence];
    });
  };

  return { predict };
};
