const { request, loginSilently } = require('../../utils/request')

const DEFAULT_DISH_IMAGE = '/assets/dish-default.png'

function normalizeDish(dish) {
  return {
    ...dish,
    imageUrl: dish.imageUrl || DEFAULT_DISH_IMAGE
  }
}

function getInitial(userInfo) {
  const nickname = userInfo && userInfo.nickname ? String(userInfo.nickname) : ''
  return nickname ? nickname.slice(0, 1) : '食'
}

Page({
  data: {
    userInfo: null,
    userInitial: '食',
    tableId: 1,
    storeId: 1,
    loggingIn: false,
    recommendationLoading: false,
    recommendedDishes: [],
    defaultImage: DEFAULT_DISH_IMAGE
  },

  onLoad() {
    const tableId = Number(wx.getStorageSync('tableId') || 1)
    const storeId = Number(wx.getStorageSync('storeId') || 1)
    const userInfo = wx.getStorageSync('userInfo')

    this.setData({
      tableId,
      storeId,
      userInfo: userInfo || null,
      userInitial: getInitial(userInfo)
    })

    if (!userInfo) {
      this.login()
    }
    this.loadRecommendations()
  },

  onShow() {
    this.setData({
      tableId: Number(wx.getStorageSync('tableId') || this.data.tableId || 1),
      storeId: Number(wx.getStorageSync('storeId') || this.data.storeId || 1)
    })
  },

  async login() {
    if (this.data.loggingIn) return
    this.setData({ loggingIn: true })
    try {
      const data = await loginSilently()
      this.setData({
        userInfo: data.user,
        userInitial: getInitial(data.user)
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '登录失败', icon: 'none' })
    } finally {
      this.setData({ loggingIn: false })
    }
  },

  async loadRecommendations() {
    this.setData({ recommendationLoading: true })
    try {
      const dishes = await request({
        url: '/dish/list',
        data: {
          storeId: this.data.storeId,
          type: 'RECOMMEND',
          keyword: ''
        }
      })
      this.setData({
        recommendedDishes: (dishes || []).slice(0, 6).map(normalizeDish)
      })
    } catch (e) {
      this.setData({ recommendedDishes: [] })
    } finally {
      this.setData({ recommendationLoading: false })
      wx.stopPullDownRefresh()
    }
  },

  onImageError(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({
      recommendedDishes: this.data.recommendedDishes.map(item => (
        Number(item.id) === id ? { ...item, imageUrl: DEFAULT_DISH_IMAGE } : item
      ))
    })
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
            storeId: Number(table.storeId)
          })
          wx.switchTab({ url: '/pages/menu/menu' })
        } catch (e) {
          wx.showToast({ title: '扫码校验失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '已取消扫码', icon: 'none' })
      }
    })
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

  goMenu() {
    const tableId = this.data.tableId
    const storeId = this.data.storeId
    wx.setStorageSync('tableId', tableId)
    wx.setStorageSync('storeId', storeId)
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goDishDetail(e) {
    wx.navigateTo({
      url: `/pages/dish-detail/dish-detail?dishId=${e.currentTarget.dataset.id}&tableId=${this.data.tableId}`
    })
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/order-history/order-history' })
  },

  goReservation() {
    const storeId = this.data.storeId || 1
    wx.setStorageSync('storeId', storeId)
    wx.navigateTo({ url: `/pages/reservation/reservation?storeId=${storeId}` })
  },

  onPullDownRefresh() {
    this.loadRecommendations()
  }
})
