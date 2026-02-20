# tensor-zero-bandits

![Bandit](bandit.png)

# How TensorZero is Fixing Your A/B Testing with Bandits

An interactive blog post explaining how TensorZero's multi-armed bandit algorithm improves LLM experimentation over traditional A/B testing.

**Live demos include:**
- A slot machine game to build intuition for the explore/exploit tradeoff
- An adaptive experiment simulator (Track-and-Stop vs. uniform A/B)
- An experiment duration estimator with configurable δ and ε parameters

## Run Locally

No installation or build step required. It's a static site.

1. Clone the repo:
   ```bash
   git clone git@github.com:michelleh1109/tensor-zero-bandits.git
   cd tensor-zero-bandits
   ```

2. Open `index.html` in your browser:
   ```bash
   open index.html        # macOS
   start index.html       # Windows
   xdg-open index.html    # Linux
   ```

That's it. All dependencies (Chart.js) are loaded via CDN, so you'll need an internet connection for the charts to render.

## Files

| File | Description |
|---|---|
| `index.html` | Main blog post and all styling |
| `bandit-sim.js` | Adaptive experiment simulator (Track-and-Stop algorithm) |
| `slot-machine.js` | Interactive slot machine game |
| `ner-charts.js` | NER experiment result charts |
| `estimator.js` | Experiment duration estimator |

## Learn More

- [TensorZero Quickstart](https://www.tensorzero.com/docs/quickstart)
- [Full Technical Writeup](https://www.tensorzero.com/blog/bandits-in-your-llm-gateway/)
- [NER Example on GitHub](https://github.com/tensorzero/tensorzero/tree/main/examples/ner-fine-tuning)
