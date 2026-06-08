const { request } = require('../../utils/request')
const cartUtil = require('../../utils/cart')

const DEFAULT_DISH_IMAGE = '/assets/dish-default.png'

function normalizeQuantity(value) {
  const quantity = parseInt(value, 10)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

Page({
  data: {
    tableId: 1,
    cart: [],
    totalAmount: '0.00',
    submitting: false,
    defaultImage: DEFAULT_DISH_IMAGE
  },

  onLoad(options) {
    const tableId = Number(options.tableId || wx.getStorageSync('tableId') || 1)
    this.setData({ tableId })
    wx.setStorageSync('tableId', tableId)
  },

  onShow() {
    this.loadCartFromStorage()
  },

  loadCartFromStorage() {
    const cart = cartUtil.getCart(this.data.tableId)
    this.setData({
      cart,
      totalAmount: cartUtil.calcTotal(cart).toFixed(2)
    })
  },

  saveCart(cart) {
    cartUtil.saveCart(this.data.tableId, cart)
    this.setData({
      cart,
      totalAmount: cartUtil.calcTotal(cart).toFixed(2)
    })
  },

  onImageError(e) {
    const key = e.currentTarget.dataset.key
    const cart = this.data.cart.map(item => (
      item.cartKey === key ? { ...item, imageUrl: DEFAULT_DISH_IMAGE } : item
    ))
    this.saveCart(cart)
  },

  increase(e) {
    const key = e.currentTarget.dataset.key
    const cart = this.data.cart.map(item => (
      item.cartKey === key ? { ...item, quantity: Number(item.quantity) + 1 } : item
    ))
    this.saveCart(cart)
  },

  decrease(e) {
    const key = e.currentTarget.dataset.key
    const cart = this.data.cart
      .map(item => (
        item.cartKey === key ? { ...item, quantity: Number(item.quantity) - 1 } : item
      ))
      .filter(item => Number(item.quantity) > 0)
    this.saveCart(cart)
  },

  updateQuantity(e) {
    const key = e.currentTarget.dataset.key
    const quantity = normalizeQuantity(e.detail.value)
    const cart = this.data.cart.map(item => (
      item.cartKey === key ? { ...item, quantity } : item
    ))
    this.saveCart(cart)
  },

  clearCart() {
    if (!this.data.cart.length) return
    wx.showModal({
      title: '清空购物车',
      content: '确定清空当前桌台的已选菜品吗？',
      success: (res) => {
        if (!res.confirm) return
        cartUtil.clearCart(this.data.tableId)
        cartUtil.clearCheckoutCart(null, this.data.tableId)
        this.setData({ cart: [], totalAmount: '0.00' })
      }
    })
  },

  goMenu() {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  async submitOrder() {
    if (this.data.submitting) return
    if (!this.data.cart.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    const checkoutCart = cartUtil.cloneCart(this.data.cart)
    cartUtil.saveCart(this.data.tableId, checkoutCart)
    cartUtil.backupPendingCart(this.data.tableId, checkoutCart)

    this.setData({ submitting: true })
    try {
      const result = await request({
        url: '/order/create',
        method: 'POST',
        data: {
          tableId: this.data.tableId,
          items: checkoutCart.map(item => ({
            dishId: item.dishId,
            quantity: item.quantity,
            spicy: item.spicy,
            size: item.size
          }))
        }
      })

      cartUtil.backupCheckoutCart(result.orderId, this.data.tableId, checkoutCart)
      wx.navigateTo({ url: `/pages/payment/payment?orderId=${result.orderId}` })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
