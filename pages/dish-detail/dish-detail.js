const { request } = require('../../utils/request')
const cart = require('../../utils/cart')

const DEFAULT_DISH_IMAGE = '/assets/dish-default.png'

function splitOptions(value) {
  return value ? String(value).split(',').map(item => item.trim()).filter(Boolean) : []
}

function normalizeQuantity(value) {
  const quantity = parseInt(value, 10)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

Page({
  data: {
    tableId: 1,
    dishId: null,
    dish: null,
    spicyOptions: [],
    sizeOptions: [],
    tasteTags: [],
    selectedSpicy: '',
    selectedSize: '',
    quantity: 1,
    subtotal: '0.00',
    defaultImage: DEFAULT_DISH_IMAGE
  },

  onLoad(options) {
    this.setData({
      dishId: Number(options.dishId),
      tableId: Number(options.tableId || wx.getStorageSync('tableId') || 1)
    })
    this.loadDetail()
  },

  async loadDetail() {
    try {
      const dish = await request({ url: `/dish/detail/${this.data.dishId}` })
      const spicyOptions = splitOptions(dish.spicyOptions)
      const sizeOptions = splitOptions(dish.sizeOptions)
      const tasteTags = splitOptions(dish.tasteTags)
      this.setData({
        dish: {
          ...dish,
          imageUrl: dish.imageUrl || DEFAULT_DISH_IMAGE
        },
        spicyOptions,
        sizeOptions,
        tasteTags,
        selectedSpicy: spicyOptions[0] || '',
        selectedSize: sizeOptions[0] || '',
        quantity: 1
      })
      this.updateSubtotal()
    } catch (e) {
      wx.showToast({ title: '菜品信息加载失败', icon: 'none' })
      wx.navigateBack()
    }
  },

  updateSubtotal() {
    const price = this.data.dish ? Number(this.data.dish.price) : 0
    this.setData({ subtotal: (price * normalizeQuantity(this.data.quantity)).toFixed(2) })
  },

  onImageError() {
    if (!this.data.dish) return
    this.setData({
      dish: {
        ...this.data.dish,
        imageUrl: DEFAULT_DISH_IMAGE
      }
    })
  },

  selectSpicy(e) {
    this.setData({ selectedSpicy: e.currentTarget.dataset.value })
  },

  selectSize(e) {
    this.setData({ selectedSize: e.currentTarget.dataset.value })
  },

  onQuantityInput(e) {
    this.setData({ quantity: e.detail.value })
  },

  onQuantityBlur(e) {
    this.setData({ quantity: normalizeQuantity(e.detail.value) })
    this.updateSubtotal()
  },

  increase() {
    const quantity = normalizeQuantity(this.data.quantity) + 1
    const price = this.data.dish ? Number(this.data.dish.price) : 0
    this.setData({
      quantity,
      subtotal: (price * quantity).toFixed(2)
    })
  },

  decrease() {
    const quantity = normalizeQuantity(this.data.quantity)
    if (quantity <= 1) return
    const nextQuantity = quantity - 1
    const price = this.data.dish ? Number(this.data.dish.price) : 0
    this.setData({
      quantity: nextQuantity,
      subtotal: (price * nextQuantity).toFixed(2)
    })
  },

  validateSpec() {
    if (!this.data.dish) return false
    if (this.data.spicyOptions.length && !this.data.selectedSpicy) {
      wx.showToast({ title: '请选择口味', icon: 'none' })
      return false
    }
    if (this.data.sizeOptions.length && !this.data.selectedSize) {
      wx.showToast({ title: '请选择规格', icon: 'none' })
      return false
    }
    return true
  },

  addToCart() {
    if (!this.validateSpec()) return
    const quantity = normalizeQuantity(this.data.quantity)
    this.setData({ quantity })
    cart.addItem(
      this.data.tableId,
      this.data.dish,
      {
        spicy: this.data.selectedSpicy,
        size: this.data.selectedSize
      },
      quantity
    )
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  goCart() {
    wx.navigateTo({ url: `/pages/cart/cart?tableId=${this.data.tableId}` })
  }
})
