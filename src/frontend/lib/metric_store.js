const instance = {
  metrics: {},
  increase: (metric) => {
    if (!instance.metrics[metric]) instance.metrics[metric] = 0;
    instance.metrics[metric] += 1;
  }
};

module.exports = instance;