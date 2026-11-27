// Compatibility facade for the original blog shop module.
//
// The canonical Hive Open Market data layer now lives in `hiveMarket.js`.
// Existing imports keep working unchanged, including `parseProductMetadata`
// and `fetchAccountProducts`, so pages do not need a coordinated rename.

export {
  decodeCursor,
  encodeCursor,
  fetchAccountProducts,
  formatProductAmount,
  isPurchasable,
  isSupportedProduct,
  listProducts,
  normalizeProduct,
  parseProductMetadata,
  productImages,
  productJsonLd,
  productTotalLabel,
  purchaseMemo
} from './hiveMarket'
