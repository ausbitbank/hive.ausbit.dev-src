<template>
  <svg
    class="sparkline"
    :class="{ 'sparkline--animated': animate, 'sparkline--fill': hasFill }"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    role="img"
    aria-hidden="true"
  >
    <defs v-if="hasFill">
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="gradientColor" stop-opacity="0.32" />
        <stop offset="100%" :stop-color="gradientColor" stop-opacity="0" />
      </linearGradient>
      <clipPath :id="clipId">
        <rect x="0" y="0" :width="width" :height="height" />
      </clipPath>
    </defs>
    <g v-if="hasFill && animate" :clip-path="`url(#${clipId})`" class="sparkline__reveal">
      <path
        v-for="(line, index) in lines"
        :key="'fill-' + index"
        :d="line.area"
        :fill="`url(#${gradientId})`"
        stroke="none"
      />
    </g>
    <path
      v-for="(line, index) in lines"
      :key="index"
      :d="line.path"
      :stroke="line.stroke"
      fill="none"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
      :class="{ 'sparkline__line': animate }"
      :style="animate ? `--spark-delay: ${index * 120}ms` : null"
    />
    <path
      v-if="lastPoint && animate"
      class="sparkline__dot"
      :cx="0"
      :cy="0"
      :transform="`translate(${lastPoint[0]} ${lastPoint[1]})`"
      r="2.2"
      :fill="lines[0]?.stroke"
    />
  </svg>
</template>

<script>
let instance = 0

export default {
  name: 'Sparkline',
  props: {
    data: { type: Array, default: null },
    series: { type: Array, default: null },
    width: { type: [Number, String], default: 250 },
    height: { type: [Number, String], default: 60 },
    stroke: { type: String, default: '#54a5ff' },
    fill: { type: String, default: 'rgba(84, 165, 255, 0.2)' },
    /** Draw the line left-to-right on mount and show a dot on the latest point. */
    animate: { type: Boolean, default: false }
  },
  data () {
    instance += 1
    return { uid: 'spark-' + instance }
  },
  computed: {
    gradientId () {
      return this.uid + '-grad'
    },
    clipId () {
      return this.uid + '-clip'
    },
    hasFill () {
      return this.fill !== 'none'
    },
    gradientColor () {
      const first = this.normalizedSeries[0]
      return first?.stroke || this.stroke
    },
    normalizedSeries () {
      if (Array.isArray(this.series) && this.series.length) {
        return this.series.map(line => ({
          values: (line.data || []).map(Number).filter(Number.isFinite),
          stroke: line.stroke || this.stroke
        }))
      }
      return [{
        values: (this.data || []).map(Number).filter(Number.isFinite),
        stroke: this.stroke
      }]
    },
    lines () {
      const width = Number(this.width)
      const height = Number(this.height)
      const pad = 2
      const all = this.normalizedSeries.flatMap(line => line.values)
      if (all.length < 2) return []

      const min = Math.min(...all)
      const max = Math.max(...all)
      const span = max - min || 1

      return this.normalizedSeries
        .filter(line => line.values.length > 1)
        .map(line => {
          const points = line.values.map((value, index) => {
            const x = pad + (index / (line.values.length - 1)) * (width - pad * 2)
            const y = height - pad - ((value - min) / span) * (height - pad * 2)
            return [x, y]
          })
          const path = points
            .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
            .join(' ')
          const area = `${path} L${points[points.length - 1][0].toFixed(2)},${height - pad} L${points[0][0].toFixed(2)},${height - pad} Z`
          return { path, area, stroke: line.stroke }
        })
    },
    lastPoint () {
      const line = this.lines[0]
      if (!line) return null
      const values = this.normalizedSeries[0].values
      const width = Number(this.width)
      const height = Number(this.height)
      const pad = 2
      const all = this.normalizedSeries.flatMap(entry => entry.values)
      const min = Math.min(...all)
      const max = Math.max(...all)
      const span = max - min || 1
      const value = values[values.length - 1]
      return [width - pad, height - pad - ((value - min) / span) * (height - pad * 2)]
    }
  }
}
</script>

<style scoped>
.sparkline {
  display: block;
  max-width: 100%;
}

.sparkline__line {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: sparkline-draw 900ms cubic-bezier(0.4, 0, 0.2, 1) var(--spark-delay, 0ms) forwards;
}

.sparkline__dot {
  opacity: 0;
  animation: sparkline-dot 240ms ease-out 820ms forwards;
}

@keyframes sparkline-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes sparkline-reveal {
  from {
    transform: scaleX(0);
    opacity: 0.2;
  }

  to {
    transform: scaleX(1);
    opacity: 1;
  }
}


@keyframes sparkline-dot {
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sparkline__line,
  .sparkline__reveal,
  .sparkline__dot {
    animation: none;
    opacity: 1;
    stroke-dasharray: none;
  }
}
</style>
