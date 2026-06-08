const { loginSilently } = require('../../utils/request')

function getInitial(userInfo) {
  const nickname = userInfo && userInfo.nickname ? String(userInfo.nickname) : ''
  return nickname ? nickname.slice(0, 1) : '我'
}

Page({
  data: {
    userInfo: null,
    userInitial: '我',
    tableId: 1,
    storeId: 1,
    loggingIn: false,
    menus: [
      { key: 'reservation', title: '我的预约', desc: '查看和管理桌台预约', icon: '约' },
      { key: 'coupon', title: '我的优惠券', desc: '查看可用优惠', icon: '券' },
      { key: 'service', title: '联系客服', desc: '获取用餐帮助', icon: '客' },
      { key: 'setting', title: '设置', desc: '账号与偏好设置', icon: '设' }
    ]
  },

  onLoad() {
    this.syncUser()
    if (!this.data.userInfo) {
      this.login()
    }
  },

  onShow() {
    this.syncUser()
  },

  syncUser() {
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      userInfo: userInfo || null,
      userInitial: getInitial(userInfo),
      tableId: Number(wx.getStorageSync('tableId') || 1),
      storeId: Number(wx.getStorageSync('storeId') || 1)
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

  handleMenu(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'reservation') {
      wx.navigateTo({ url: '/pages/reservation-list/reservation-list' })
      return
    }
    wx.showToast({ title: '功能建设中', icon: 'none' })
  }
})
