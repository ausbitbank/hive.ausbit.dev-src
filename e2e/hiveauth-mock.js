import { waitForApp } from './helpers'

// A minimal HiveAuth relay stand-in for the login dialog. `attachNack` makes a
// resume attempt fail explicitly, which is the only response a browser test can
// produce without the client-generated AES key.
export async function installMockRelay (page, { attachNack = false } = {}) {
  await page.addInitScript(({ attachNack }) => {
    class MockWebSocket {
      constructor () {
        this.readyState = 0
        this.onopen = null
        this.onmessage = null
        this.onerror = null
        this.onclose = null
        setTimeout(() => {
          this.readyState = 1
          this.onopen?.()
          this.onmessage?.({
            data: JSON.stringify({
              cmd: 'connected',
              timeout: 60,
              version: '0.8.10',
              protocol: 0.8
            })
          })
        }, 10)
      }

      send (raw) {
        const message = JSON.parse(raw)
        if (message.cmd === 'attach_req') {
          sessionStorage.setItem('e2e-has-attach', message.uuid)
          if (attachNack) {
            setTimeout(() => {
              this.onmessage?.({
                data: JSON.stringify({ cmd: 'attach_nack', uuid: message.uuid })
              })
            }, 20)
          }
          return
        }
        if (message.cmd !== 'auth_req') return
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({
              cmd: 'auth_wait',
              uuid: 'e2e-hiveauth-uuid',
              expire: Date.now() + 60_000
            })
          })
        }, 20)
      }

      close () {
        this.readyState = 3
      }
    }
    window.WebSocket = MockWebSocket
  }, { attachNack })
}

export async function openHiveAuthLogin (page) {
  await page.goto('/')
  await waitForApp(page)
  await page.locator('.account-trigger').click()
  await page.locator('.login-username input').fill('ausbitbank')
  await page.locator('.login-username input').press('Enter')
  await page.getByRole('button', { name: 'HiveAuth' }).click()
}
