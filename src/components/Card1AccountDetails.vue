<template>
  <div>
  <q-card>
    <q-tabs v-model="card1AccountDetailsTab" dense align="justify" narrow-indicator indicator-color="secondary">
      <q-tab name="account" label="Account" />
      <q-tab name="profile" label="Profile" />
      <q-tab name="resourceCredits" label="Resource Credits" />
      <q-tab name="witnessVotes" label="Witness Votes" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="card1AccountDetailsTab" animated>
    <q-tab-panel name="account">
      <div>
        <span class="text-bold q-pa-md">
          Id
        </span>
        <span class="q-pa-md">
          {{ A.id }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Name
        </span>
        <span class="q-pa-md">
          {{ A.name }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Recovery Account
        </span>
        <span class="q-pa-md">
          {{ A.recovery_account }}
        </span>
        <q-btn label="Change recovery account" />
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Reset Account
        </span>
        <span class="q-pa-md">
          {{ A.reset_account}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Witness Proxy
        </span>
        <span class="q-pa-md">
          {{ A.proxy}}
        </span>
        <q-btn label="Change Witness Proxy" />
      </div>
      <q-separator />
      <div>
        <span class="text-bold q-pa-md">
          Created
        </span>
        <span class="q-pa-md">
          {{ A.created}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Vote Time
        </span>
        <span class="q-pa-md">
          {{ A.last_vote_time }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Root Post
        </span>
        <span class="q-pa-md">
          {{ A.last_root_post}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Post
        </span>
        <span class="q-pa-md">
          {{ A.last_post}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Account Update
        </span>
        <span class="q-pa-md">
          {{ A.last_account_update}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Account Recovery
        </span>
        <span class="q-pa-md">
          {{ A.last_account_recovery }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Last Owner Update
        </span>
        <span class="q-pa-md">
          {{ A.last_owner_update }}
        </span>
      </div>
      <q-separator />
      <div>
        <span class="text-bold q-pa-md">
          Owner Key
        </span>
        <span class="q-pa-md">
          {{ A.owner['key_auths'][0][0] }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Active Key
        </span>
        <span class="q-pa-md">
          {{ A.active['key_auths'][0][0] }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Posting Key
        </span>
        <span class="q-pa-md">
          {{ A.posting['key_auths'][0][0] }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Memo Key
        </span>
        <span class="q-pa-md">
          {{ A.memo_key }}
        </span>
      </div>
      <q-separator />
      <div>
        <span class="text-bold q-pa-md">
          Mined
        </span>
        <span class="q-pa-md">
          {{ A.mined}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Can Vote
        </span>
        <span class="q-pa-md">
          {{ A.can_vote}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Tags Usage
        </span>
        <span class="q-pa-md">
          {{ A.tags_usage.length }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Guest Bloggers
        </span>
        <span class="q-pa-md">
          {{ A.guest_bloggers}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Withdraw Routes
        </span>
        <span class="q-pa-md">
          {{ A.withdraw_routes}}
        </span>
      </div>
      <q-separator />
      <div>
        <span class="text-bold q-pa-md">
          HBD Seconds
        </span>
        <span class="q-pa-md">
          {{ A.sbd_seconds}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          HBD Seconds Last Update
        </span>
        <span class="q-pa-md">
          {{ A.sbd_seconds_last_update}}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          HBD Last Interest Payment
        </span>
        <span class="q-pa-md">
          {{ A.sbd_last_interest_payment }}
        </span>
      </div>
      <q-separator />
      <div>
        <span class="text-bold q-pa-md">
          Savings HBD Seconds
        </span>
        <span class="q-pa-md">
          {{ A.savings_sbd_seconds }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Savings HBD Seconds Last Update
        </span>
        <span class="q-pa-md">
          {{ A.savings_sbd_seconds_last_update }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Savings HBD Last Interest Payment
        </span>
        <span class="q-pa-md">
          {{ A.savings_sbd_last_interest_payment }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Savings Withdraw Requests
        </span>
        <span class="q-pa-md">
          {{ A.savings_withdraw_requests }}
        </span>
      </div>
    </q-tab-panel>
    <q-tab-panel name="profile">
      <div>
        <span class="text-bold q-pa-md">
          Name
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.name }}
        </span>
      </div>
      <div v-if="AccountMeta.profile.about">
        <span class="text-bold q-pa-md">
          About
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.about }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Website
        </span>
        <span class="q-pa-md">
          <a :href="AccountMeta.profile.website">{{ AccountMeta.profile.website }}</a>
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Location
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.location }}
        </span>
      </div>
      <div v-if="AccountMeta.profile.cover_image">
        <span class="text-bold q-pa-md">
          Cover Image
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.cover_image }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Profile Image
        </span>
        <span>
          <q-avatar>
            <q-img :src="GetHiveAvatarUrl(A.name)" />
          </q-avatar>
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.profile_image }}
        </span>
      </div>
      <div v-if="AccountMeta.profile.witness_description">
        <span class="text-bold q-pa-md">
          Witness Description
        </span>
        <span class="q-pa-md">
          {{ AccountMeta.profile.witness_description }}
        </span>
      </div>
    </q-tab-panel>
    <q-tab-panel name="resourceCredits">
      <div>
        <span class="text-bold q-pa-md">
          Current RC Status
        </span>
        <span class="q-pa-md">
          {{ RC.percent }} %
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Current RC
        </span>
        <span class="q-pa-md">
          {{ RC.current }}
        </span>
      </div>
      <div>
        <span class="text-bold q-pa-md">
          Max RC
        </span>
        <span class="q-pa-md">
          {{ RC.max }}
        </span>
      </div>
    </q-tab-panel>
    <q-tab-panel name="witnessVotes">
      <q-btn label="Vote for Witnesses" />
      <div v-for="witness in A.witness_votes" :key="witness.index">
        <span class="q-pa-md text-bold">{{ witness }}</span>
        <q-btn label="Remove" icon="delete" bordered push dense />
      </div>
    </q-tab-panel>
  </q-tab-panels>
  </q-card>
  </div>
</template>

<script>
export default {
  name: 'Card1AccountDetails',
  props: ['A', 'RC'],
  data () {
    return {
      card1AccountDetailsTab: 'account'
    }
  },
  computed: {
    AccountMeta: function () {
      if (this.A === null) {
        return null
      } else {
        return JSON.parse(this.A.json_metadata)
      }
    }
  },
  methods: {
    GetHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' }
  }
}
</script>
