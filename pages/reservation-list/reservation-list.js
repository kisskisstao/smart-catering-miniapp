const { request } = require('../../utils/request')

const STATUS_TEXT = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  CANCELLED: '已取消'
}

function normalizeReservation(item) {
  return {
    ...item,
    statusText: STATUS_TEXT[item.status] || item.status,
    dateTime: `${item.reservationDate || ''} ${item.reservationTime || ''}`.trim()
  }
}

Page({
  data: {
    reservations: [],
    pageNo: 1,
    pageSize: 10,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadReservations(true)
  },

  onShow() {
    this.loadReservations(true)
  },

  async loadReservations(reset) {
    if (this.data.loading) return
    const pageNo = reset ? 1 : this.data.pageNo
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/reservation/my',
        data: {
          pageNo,
          pageSize: this.data.pageSize
        }
      })
      const records = (data.records || []).map(normalizeReservation)
      this.setData({
        reservations: reset ? records : this.data.reservations.concat(records),
        pageNo: pageNo + 1,
        hasMore: records.length === this.data.pageSize
      })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  createReservation() {
    wx.navigateTo({ url: '/pages/reservation/reservation' })
  },

  cancelReservation(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消预约',
      content: '确定取消这条预约吗？',
      success: async (res) => {
        if (!res.confirm) return
        await request({
          url: `/reservation/${id}/cancel`,
          method: 'PUT'
        })
        wx.showToast({ title: '已取消', icon: 'success' })
        this.loadReservations(true)
      }
    })
  },

  onPullDownRefresh() {
    this.loadReservations(true)
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadReservations(false)
    }
  }
})
