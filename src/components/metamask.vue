<template>
    <q-btn v-if="type === 'button'" id='metamaskConnectButton' dense round type="btn" @click="clickButton()" icon="img:statics/metamask.svg" title="Send with Metamask" color="primary" class="hvr" />
</template>
<script>
import detectEthereumProvider from '@metamask/detect-provider'
export default {
  name: 'metamask',
  props: ['type', 'to'],
  data () {
    return {
      ethAccount: null
    }
  },
  methods: {
    clickButton () {
      if (this.ethAccount === null) {
        console.log('finding sender eth account')
        this.connect()
      } else {
        console.log('sending eth from ' + this.ethAccount + ' to ' + this.to)
        this.transferEthMetamask(this.to)
      }
    },
    transferEthMetamask (to) {
      try {
        const transactionHash = window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [
            {
              to: to,
              from: this.currentAccount,
              value: '0.1'
            }
          ]
        })
        console.log('txhash')
        console.log(transactionHash)
      } catch (error) {
        console.error(error)
      }
    },
    checkEthMetaMask () {
      console.log('Metamask available ?')
      console.log(window.ethereum.isConnected())
    },
    async getEthProvider () {
      const provider = await detectEthereumProvider()
      if (provider) {
        this.startApp(provider) // Initialize your app
      } else {
        console.log('Please install MetaMask!')
      }
    },
    async getEthChainId () {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' })
      this.handleChainChanged(chainId)
      window.ethereum.on('chainChanged', this.handleChainChanged)
    },
    handleChainChanged (_chainId) {
      window.location.reload()
    },
    getEthAccount () {
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then(this.handleAccountsChanged)
        .catch((err) => {
          console.error(err)
        })
    },
    handleAccountsChanged (accounts) {
      if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        console.log('Please connect to MetaMask.')
      } else if (accounts[0] !== this.ethAccount) {
        this.currentAccount = accounts[0]
      }
    },
    startApp (provider) {
      console.log('provider:')
      console.log(provider)
      if (provider !== window.ethereum) {
        console.error('Do you have multiple wallets installed?')
      }
    },
    connect () {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then(this.handleAccountsChanged)
        .catch((err) => {
          if (err.code === 4001) {
            console.log('Please connect to MetaMask.')
          } else {
            console.error(err)
          }
        })
    }
  },
  mounted () {
    this.getEthProvider()
    window.ethereum.on('accountsChanged', this.handleAccountsChanged)
  }
}
</script>
