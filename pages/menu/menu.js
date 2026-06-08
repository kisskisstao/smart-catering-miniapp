const { request } = require('../../utils/request')
const cartUtil = require('../../utils/cart')

const DEFAULT_DISH_IMAGE = '/assets/dish-default.png'

function splitOptions(value) {
  return value ? String(value).split(',').map(item => item.trim()).filter(Boolean) : []
}

function normalizeQuantity(value) {
  const quantity = parseInt(value, 10)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function normalizeDish(dish) {
  const specs = Array.isArray(dish.specs)
    ? dish.specs
        .filter(item => item && item.name && item.status !== 'OFF')
        .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    : []
  const sizeItems = specs.length
    ? specs.map(item => ({ name: item.name, price: Number(item.price || dish.price) }))
    : splitOptions(dish.sizeOptions).map(name => ({ name, price: Number(dish.price || 0) }))

  return {
    ...dish,
    imageUrl: dish.imageUrl || DEFAULT_DISH_IMAGE,
    price: Number(dish.price || 0),
    selectedQuantity: 0,
    spicyList: splitOptions(dish.spicyOptions),
    sizeList: sizeItems.map(item => item.name),
    sizeItems
  }
}

Page({
  data: {
    storeId: 1,
    tableId: 1,
    type: 'HOT',
    categoryId: 'HOT',
    keyword: '',
    categories: [],
    allDishes: [],
    dishes: [],
    cart: [],
    cartCount: 0,
    cartTotal: '0.00',
    cartExpanded: false,
    loading: false,
    submitting: false,
    specVisible: false,
    currentDish: null,
    selectedSpicy: '',
    selectedSize: '',
    selectedSpecPrice: 0,
    specQuantity: 1,
    defaultImage: DEFAULT_DISH_IMAGE
  },

  onLoad(options) {
    const storeId = Number(options.storeId || wx.getStorageSync('storeId') || 1)
    const tableId = Number(options.tableId || wx.getStorageSync('tableId') || 1)
    this.setData({ storeId, tableId })
    wx.setStorageSync('storeId', storeId)
    wx.setStorageSync('tableId', tableId)
    this.loadCategories()
    this.loadDishes()
  },

  onShow() {
    this.refreshCart()
  },

  onHide() {
    if (this.data.cart.length) {
      cartUtil.backupPendingCart(this.data.tableId, this.data.cart.map(item => ({ ...item })))
    }
  },

  async loadCategories() {
    try {
      const categories = await request({
        url: '/merchant/category/list',
        data: { storeId: this.data.storeId }
      })
      this.setData({ categories: categories || [] })
    } catch (e) {
      this.setData({ categories: [] })
    }
  },

  async loadDishes() {
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/dish/list',
        data: {
          storeId: this.data.storeId,
          type: this.data.type,
          keyword: this.data.keyword
        }
      })
      this.setData({ allDishes: (data || []).map(normalizeDish) })
      this.refreshCart()
    } catch (e) {
      this.setData({ allDishes: [], dishes: [] })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  filterByCategory(dishes, categoryId) {
    if (!categoryId || categoryId === 'HOT') return dishes
    return dishes.filter(item => Number(item.categoryId) === Number(categoryId))
  },

  syncDishQuantities(dishes, cart) {
    return dishes.map(dish => {
      const selectedQuantity = cart
        .filter(item => Number(item.dishId) === Number(dish.id))
        .reduce((sum, item) => sum + Number(item.quantity), 0)
      return { ...dish, selectedQuantity }
    })
  },

  refreshCart() {
    const rawCart = cartUtil.restoreCheckoutCart(this.data.tableId)
    const cart = rawCart.map(item => ({
      ...item,
      amount: (Number(item.price) * Number(item.quantity)).toFixed(2)
    }))
    const allDishes = this.syncDishQuantities(this.data.allDishes, cart)
    this.setData({
      cart,
      allDishes,
      dishes: this.filterByCategory(allDishes, this.data.categoryId),
      cartCount: cart.reduce((sum, item) => sum + Number(item.quantity), 0),
      cartTotal: cartUtil.calcTotal(cart).toFixed(2)
    })
  },

  switchCategory(e) {
    const rawId = e.currentTarget.dataset.id
    const categoryId = rawId === '' ? null : rawId
    const type = categoryId === 'HOT' ? 'HOT' : 'ALL'
    this.setData({ type, categoryId })
    this.loadDishes()
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  search() {
    this.loadDishes()
  },

  clearSearch() {
    this.setData({ keyword: '', categoryId: null, type: 'ALL' })
    this.loadDishes()
  },

  scanTable() {
    wx.scanCode({
      onlyFromCamera: true,
      success: async (res) => {
        const params = this.parseQrParams(res.result)
        if (!params.tableId || !params.qrToken) {
          wx.showToast({ title: '无效桌台二维码', icon: 'none' })
          return
        }
        try {
          const table = await request({
            url: '/table/scan',
            data: {
              tableId: params.tableId,
              qrToken: params.qrToken
            }
          })
          wx.setStorageSync('tableId', table.tableId)
          wx.setStorageSync('storeId', table.storeId)
          this.setData({
            tableId: Number(table.tableId),
            storeId: Number(table.storeId),
            categoryId: 'HOT',
            type: 'HOT'
          })
          this.loadCategories()
          this.loadDishes()
        } catch (e) {
          wx.showToast({ title: '扫码校验失败', icon: 'none' })
        }
      }
    })
  },

  goReservation() {
    wx.navigateTo({ url: `/pages/reservation/reservation?storeId=${this.data.storeId}` })
  },

  parseQrParams(value) {
    const query = value.includes('?') ? value.split('?')[1] : ''
    const params = {}
    if (!query && /^\d+$/.test(value)) {
      params.tableId = value
      return params
    }
    query.split('&').forEach(item => {
      const [key, val] = item.split('=')
      if (key) params[key] = decodeURIComponent(val || '')
    })
    return params
  },

  onPullDownRefresh() {
    this.loadCategories()
    this.loadDishes()
  },

  onImageError(e) {
    const id = Number(e.currentTarget.dataset.id)
    const updateImage = item => Number(item.id) === id ? { ...item, imageUrl: DEFAULT_DISH_IMAGE } : item
    this.setData({
      allDishes: this.data.allDishes.map(updateImage),
      dishes: this.data.dishes.map(updateImage)
    })
  },

  openSpec(e) {
    const id = Number(e.currentTarget.dataset.id)
    const dish = this.data.allDishes.find(item => Number(item.id) === id)
    if (!dish) return
    this.setData({
      specVisible: true,
      currentDish: dish,
      selectedSpicy: dish.spicyList[0] || '',
      selectedSize: dish.sizeList[0] || '',
      selectedSpecPrice: this.getSpecPrice(dish, dish.sizeList[0] || ''),
      specQuantity: 1
    })
  },

  decreaseDishOne(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.cart.find(cartItem => Number(cartItem.dishId) === id)
    if (!item) return
    cartUtil.updateQuantity(this.data.tableId, item.cartKey, Number(item.quantity) - 1)
    this.refreshCart()
    if (!this.data.cart.length) {
      this.setData({ cartExpanded: false })
    }
  },

  closeSpec() {
    this.setData({ specVisible: false, currentDish: null })
  },

  selectSpicy(e) {
    this.setData({ selectedSpicy: e.currentTarget.dataset.value })
  },

  selectSize(e) {
    const selectedSize = e.currentTarget.dataset.value
    this.setData({
      selectedSize,
      selectedSpecPrice: this.getSpecPrice(this.data.currentDish, selectedSize)
    })
  },

  getSpecPrice(dish, size) {
    if (!dish) return 0
    const matched = (dish.sizeItems || []).find(item => item.name === size)
    return Number((matched ? matched.price : dish.price) || 0)
  },

  onSpecQuantityInput(e) {
    this.setData({ specQuantity: e.detail.value })
  },

  onSpecQuantityBlur(e) {
    this.setData({ specQuantity: normalizeQuantity(e.detail.value) })
  },

  increaseSpecQuantity() {
    this.setData({ specQuantity: normalizeQuantity(this.data.specQuantity) + 1 })
  },

  decreaseSpecQuantity() {
    const quantity = normalizeQuantity(this.data.specQuantity)
    if (quantity <= 1) return
    this.setData({ specQuantity: quantity - 1 })
  },

  validateSpec() {
    const dish = this.data.currentDish
    if (!dish) return false
    if (dish.spicyList.length && !this.data.selectedSpicy) {
      wx.showToast({ title: '请选择口味', icon: 'none' })
      return false
    }
    if (dish.sizeList.length && !this.data.selectedSize) {
      wx.showToast({ title: '请选择规格', icon: 'none' })
      return false
    }
    return true
  },

  addSelectedToCart() {
    if (!this.validateSpec()) return
    const quantity = normalizeQuantity(this.data.specQuantity)
    cartUtil.addItem(
      this.data.tableId,
      this.data.currentDish,
      {
        spicy: this.data.selectedSpicy,
        size: this.data.selectedSize,
        price: this.data.selectedSpecPrice || this.data.currentDish.price
      },
      quantity
    )
    this.closeSpec()
    this.refreshCart()
    this.setData({ cartExpanded: true })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  async buySelectedNow() {
    if (!this.validateSpec() || this.data.submitting) return
    const quantity = normalizeQuantity(this.data.specQuantity)
    this.setData({ submitting: true, specQuantity: quantity })
    try {
      const result = await request({
        url: '/order/create',
        method: 'POST',
        data: {
          tableId: this.data.tableId,
          items: [{
            dishId: this.data.currentDish.id,
            quantity,
            spicy: this.data.selectedSpicy,
            size: this.data.selectedSize
          }]
        }
      })
      this.closeSpec()
      wx.navigateTo({ url: `/pages/payment/payment?orderId=${result.orderId}` })
    } finally {
      this.setData({ submitting: false })
    }
  },

  toggleCart() {
    if (!this.data.cart.length) return
    this.setData({ cartExpanded: !this.data.cartExpanded })
  },

  increaseCartItem(e) {
    const key = e.currentTarget.dataset.key
    const item = this.data.cart.find(cartItem => cartItem.cartKey === key)
    if (!item) return
    cartUtil.updateQuantity(this.data.tableId, key, Number(item.quantity) + 1)
    this.refreshCart()
  },

  decreaseCartItem(e) {
    const key = e.currentTarget.dataset.key
    const item = this.data.cart.find(cartItem => cartItem.cartKey === key)
    if (!item) return
    cartUtil.updateQuantity(this.data.tableId, key, Number(item.quantity) - 1)
    this.refreshCart()
    if (this.data.cart.length <= 1 && Number(item.quantity) <= 1) {
      this.setData({ cartExpanded: false })
    }
  },

  updateCartItemQuantity(e) {
    const key = e.currentTarget.dataset.key
    const quantity = normalizeQuantity(e.detail.value)
    cartUtil.updateQuantity(this.data.tableId, key, quantity)
    this.refreshCart()
  },

  clearCart() {
    if (!this.data.cart.length) return
    wx.showModal({
      title: '清空购物车',
      content: '确定清空当前已选菜品吗？',
      success: (res) => {
        if (!res.confirm) return
        cartUtil.clearCart(this.data.tableId)
        cartUtil.clearCheckoutCart(null, this.data.tableId)
        this.setData({ cartExpanded: false })
        this.refreshCart()
      }
    })
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?dishId=${e.currentTarget.dataset.id}&tableId=${this.data.tableId}`
    })
  },

  async submitOrder() {
    if (this.data.submitting) return
    if (!this.data.cart.length) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      const checkoutCart = this.data.cart.map(item => ({ ...item }))
      cartUtil.backupPendingCart(this.data.tableId, checkoutCart)
      const result = await request({
        url: '/order/create',
        method: 'POST',
        data: {
          tableId: this.data.tableId,
          items: this.data.cart.map(item => ({
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
