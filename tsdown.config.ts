export default {
  entry: {
    index: './src/index.ts',
    serialize: './src/serialize.ts',
  },
  clean: true,
  dts: true,
  format: 'esm',
  outDir: 'dist',
  sourcemap: true,
};
