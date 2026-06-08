function getCartKey(tableId) {
  return `cart_${tableId || 'default'}`
}

function getCheckoutKey(orderId) {
  return `checkout_cart_${orderId}`
}

function getCheckoutTableKey(tableId) {
  return `checkout_cart_table_${tableId || 'default'}`
}

function getPendingCartKey(tableId) {
  return `pending_cart_${tableId || 'default'}`
}

function getCart(tableId) {
  return wx.getStorageSync(getCartKey(tableId)) || []
}

function saveCart(tableId, cart) {
  wx.setStorageSync(getCartKey(tableId), cart)
}

function addItem(tableId, dish, spec, quantity) {
  const cart = getCart(tableId)
  const cartKey = `${dish.id}_${spec.spicy || ''}_${spec.size || ''}`
  const existed = cart.find(item => item.cartKey === cartKey)
  const price = Number(spec.price || dish.price || 0)

  if (existed) {
    existed.quantity += quantity
  } else {
    cart.push({
      cartKey,
      dishId: dish.id,
      name: dish.name,
      imageUrl: dish.imageUrl,
      price,
      spicy: spec.spicy || '',
      size: spec.size || '',
      quantity
    })
  }

  saveCart(tableId, cart)
  return cart
}

function updateQuantity(tableId, cartKey, quantity) {
  let cart = getCart(tableId)
  if (quantity <= 0) {
    cart = cart.filter(item => item.cartKey !== cartKey)
  } else {
    cart = cart.map(item => {
      if (item.cartKey === cartKey) {
        return { ...item, quantity }
      }
      return item
    })
  }
  saveCart(tableId, cart)
  return cart
}

function clearCart(tableId) {
  wx.removeStorageSync(getCartKey(tableId))
}

function cloneCart(cart) {
  return (cart || []).map(item => ({ ...item }))
}

function backupCheckoutCart(orderId, tableId, cart) {
  if (!orderId || !cart || !cart.length) return
  const snapshot = {
    orderId,
    tableId,
    cart,
    createTime: Date.now()
  }
  wx.setStorageSync(getCheckoutKey(orderId), snapshot)
  wx.setStorageSync(getCheckoutTableKey(tableId), orderId)
}

function backupPendingCart(tableId, cart) {
  if (!cart || !cart.length) return
  wx.setStorageSync(getPendingCartKey(tableId), {
    tableId,
    cart,
    createTime: Date.now()
  })
}

function restoreCheckoutCart(tableId) {
  const currentCart = getCart(tableId)
  if (currentCart.length) {
    console.log('[cart restore] current cart', tableId, currentCart.length)
    return currentCart
  }

  const orderId = wx.getStorageSync(getCheckoutTableKey(tableId))
  if (orderId) {
    const snapshot = wx.getStorageSync(getCheckoutKey(orderId))
    if (snapshot && snapshot.cart && snapshot.cart.length) {
      console.log('[cart restore] order snapshot', tableId, orderId, snapshot.cart.length)
      saveCart(tableId, snapshot.cart)
      return snapshot.cart
    }
  }

  const pendingSnapshot = wx.getStorageSync(getPendingCartKey(tableId))
  if (!pendingSnapshot || !pendingSnapshot.cart || !pendingSnapshot.cart.length) return currentCart

  console.log('[cart restore] pending snapshot', tableId, pendingSnapshot.cart.length)
  saveCart(tableId, pendingSnapshot.cart)
  return pendingSnapshot.cart
}

function clearCheckoutCart(orderId, tableId) {
  if (orderId) {
    wx.removeStorageSync(getCheckoutKey(orderId))
  }
  if (tableId) {
    wx.removeStorageSync(getCheckoutTableKey(tableId))
    wx.removeStorageSync(getPendingCartKey(tableId))
  }
}

function calcTotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
}

module.exports = {
  getCart,
  saveCart,
  addItem,
  updateQuantity,
  clearCart,
  cloneCart,
  backupPendingCart,
  backupCheckoutCart,
  restoreCheckoutCart,
  clearCheckoutCart,
  calcTotal
}
