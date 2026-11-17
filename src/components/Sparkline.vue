<template>
  <svg
    class="sparkline"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    role="img"
    aria-hidden="true"
  >
    <path
      v-for="(line, index) in lines"
      :key="index"
      :d="line.path"
      :stroke="line.stroke"
      :fill="line.fill"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<script>
export default {
  name: 'Sparkline',
  props: {
    data: { type: Array, default: null },
    series: { type: Array, default: null },
    width: { type: [Number, String], default: 250 },
    height: { type: [Number, String], default: 60 },
    stroke: { type: String, default: '#54a5ff' },
    fill: { type: String, default: 'rgba(84, 165, 255, 0.2)' }
  },
  computed: {
    normalizedSeries () {
      if (Array.isArray(this.series) && this.series.length) {
        return this.series.map(line => ({
          values: (line.data || []).map(Number).filter(Number.isFinite),
          stroke: line.stroke || this.stroke,
          fill: line.fill || 'none'
        }))
      }
      return [{
        values: (this.data || []).map(Number).filter(Number.isFinite),
        stroke: this.stroke,
        fill: this.fill
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
          const area = line.fill === 'none'
            ? path
            : `${path} L${points[points.length - 1][0].toFixed(2)},${height - pad} L${points[0][0].toFixed(2)},${height - pad} Z`
          return { path: area, stroke: line.stroke, fill: line.fill }
        })
    }
  }
}
</script>

<style scoped>
.sparkline {
  display: block;
  max-width: 100%;
}
</style>
