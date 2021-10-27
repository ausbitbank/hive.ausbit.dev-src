<template>
  <q-card flat style="max-width: 600px; min-width: 400px; min-height: 400px;" class="q-pa-sm q-ma-sm">
    <img src="/statics/changelly.svg" />
    <q-card-section class="text-center text-title" v-if="to !== '' && address !== ''">
      Exchange for <b>{{ to }}</b>, send to <b>{{ address }}</b>
      <div class="text-caption" v-if="memo !== ''"><b>memo</b>: {{ memo }}</div>
    </q-card-section>
    <iframe width="570" height="400" frameborder='none' :src="frameUrl" />
  </q-card>
</template>

<script>
export default {
  name: 'changelly',
  props: {
    fromDefault: {
      type: String,
      required: false,
      default () { return 'btc' }
    },
    toDefault: {
      type: String,
      required: false,
      default () { return 'hive' }
    },
    from: {
      type: String,
      required: false,
      default () { return 'zrx,zil,zen,zec,zcl,zap,ygg,yfii,yfi,xzc,xyo,xym,xvs,xvg,xtz,xrc,xmr,xmo,xlm,xhv,xem,xdn,xdc,xaur,wtc,wliti,wings,wbtc,waxp,wax,waves,wada,wabi,vtho,vtc,vlx,vidt,vib,vgx,vet,ven,utk,usnbt,usdt20,usdt,usdp,usdc,uni,uma,tusd,tt,trx,trst,trigx,ton,tomo,tnb,tlm,tkn,time,theta,tfuel,tel,sys,sybc,sxp,swt,sushi,sub,stx,strax,strat,storm,storj,steem,stc,stak,srm,solve,solo,sol,snx,snt,snm,sngls,smart,slp,skin,shib,sbd,sand,salt,rvn,roobee,rlc,rfr,req,repv2,rep,ren,rdn,rcn,rari,rads,rad,r,qtum,qsp,qnt,qcn,ptoy,psl,psg,proc,ppt,ppc,powr,pot,poly,poe,pma,pltc,plr,pivx,phx,phb,pay,paxg,pat,part,ont,ong,one,omg,okb,occada,occ,nxt,nut,nrg,noah,nmr,nlg,nim,ngc,nexo,neo,nebl,nav,nano,myst,mtl,mo,mln,mkr,mith,mdx,mco,mbox,matic,mask,mana,maid,luna,lun,ltc,lsk,lrc,loom,link,levl,leo,lcx,lbc,ksm,knc,kmd,kin-old,kin,kick,kava,juv,iqq,iotx,iota,iost,ilv,ignis,idrt,idex,icx,icp,ht,hsr,hot,hmq,hive,hex,hedg,hbar,gvt,gusd,gup,grt,grs,golos,gnt,gno,glm,ghost,gbyte,gbg,gasp,gas,game,gala,fun,ftt,ftm,front,flow,firo,fio,fil,fida,fet,fcn,exp,exm,eurs,etn,ethos,etc,esh,erk,erg,eqx,eosdt,eos,enj,elf,egld,edg,dydx,dsh,dov,dot,doge,dnt,dgtx,dgd,dgb,dent,ddrt,ddr,dct,dcr,dcn,dash,dar,dai,cvc,cur,ctsi,ctr,crv,croold,coti,comp,cns,cnd,cmt,cl,ckb,chz,chr,cfi,celr,celo,cake,c98,busd,btt,btrst,btg,btcv,btcp,bsv,brg,brd,bnt,bnbbsc,bnb,bkx,betr,bet,bdg,bcn,bch,bcd,bat,bal,bake,aya,axs,ava,atri,atom,atl,ata,ast,asp,arrr,arn,ark,ardr,appc,ant,ankr,amp,amb,alpha,alice,algo,aion,agld,aeon,ae,adx,adk,ada,acm,ach,abyss,aave,1st,1inch,xrp,eth,btc' }
    },
    memo: {
      type: String,
      required: false,
      default () { return '' }
    },
    to: {
      type: String,
      required: false,
      default () { return 'HIVE' }
    },
    defaultAmount: {
      type: Number,
      required: false,
      default () { return 0.1 }
    },
    address: {
      type: String,
      required: false,
      default () { return '' }
    }
  },
  data () {
    return {
    }
  },
  methods: {
  },
  computed: {
    loggedInUser: function () { return this.$store.state.hive.user.username },
    frameUrl: function () {
      var url = 'https://widget.changelly.com/?'
      var params = {
        from: this.from,
        to: this.to,
        amount: this.defaultAmount,
        address: this.address,
        fromDefault: this.fromDefault,
        toDefault: this.toDefault,
        defaultAmount: this.defaultAmount,
        payment_id: this.memo,
        theme: 'default', // default
        merchant_id: 'UFrGEyEbTjdEJSkl',
        v: 3
      }
      var qs = Object.keys(params).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&')
      console.log(url + qs)
      return url + qs
    }
  },
  mounted () {
  }
}
</script>
