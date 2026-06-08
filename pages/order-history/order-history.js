const { request } = require('../../utils/request')

const STATUS_TEXT = {
  PENDING_PAYMENT: '待支付',
  WAIT_ACCEPT: '待接单',
  COOKING: '制作中',
  COMPLETED: '已完成',
  CANCELLED: '已取消'
}

function buildItemsText(items) {
  if (!Array.isArray(items) || !items.length) {
    return '暂无菜品明细'
  }
  return items
    .map(item => `${item.dishName || '菜品'} x${item.quantity || 1}`)
    .join('、')
}

function normalizeOrder(order) {
  const orderNo = String(order.orderNo || order.id || '')
  const items = Array.isArray(order.items) ? order.items : []
  return {
    ...order,
    items,
    itemsText: buildItemsText(items),
    shortOrderNo: orderNo ? orderNo.slice(-6) : '',
    statusText: order.statusText || STATUS_TEXT[order.status] || order.status,
    amountText: Number(order.totalAmount || 0).toFixed(2)
  }
}

Page({
  data: {
    orders: [],
    status: 'ALL',
    statusTabs: [
      { value: 'ALL', text: '全部' },
      { value: 'PENDING_PAYMENT', text: '待支付' },
      { value: 'WAIT_ACCEPT', text: '待接单' },
      { value: 'COOKING', text: '制作中' },
      { value: 'COMPLETED', text: '已完成' },
      { value: 'CANCELLED', text: '已取消' }
    ],
    pageNo: 1,
    pageSize: 10,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadOrders(true)
  },

  onShow() {
    this.loadOrders(true)
  },

  async loadOrders(reset) {
    if (this.data.loading) return
    const pageNo = reset ? 1 : this.data.pageNo
    this.setData({ loading: true })

    try {
      const data = await request({
        url: '/order/history',
        data: {
          status: this.data.status,
          pageNo,
          pageSize: this.data.pageSize
        }
      })
      const records = (data.records || []).map(normalizeOrder)
      this.setData({
        orders: reset ? records : this.data.orders.concat(records),
        pageNo: pageNo + 1,
        hasMore: records.length === this.data.pageSize
      })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  switchStatus(e) {
    const status = e.currentTarget.dataset.status
    if (status === this.data.status) return
    this.setData({
      status,
      orders: [],
      pageNo: 1,
      hasMore: true
    })
    this.loadOrders(true)
  },

  onPullDownRefresh() {
    this.loadOrders(true)
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.loadOrders(false)
    }
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?orderId=${e.currentTarget.dataset.id}`
    })
  }
})
