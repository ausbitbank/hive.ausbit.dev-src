<template>
<q-card flat bordered class="q-pa-sm q-ma-md text-center">
  <q-card-section>
    <div class="text-h5 text-center">
        Authorities
        <q-btn flat icon="edit" color="orange" v-if="loggedInUser === account.name" title="Edit account authorities" @click="editorEnabled = !editorEnabled" class="hvr" />
    </div>
  </q-card-section>
  <q-card-section v-if="witness">
    <div class="text-h6">Signing <q-icon name="info" color="info" title="Signing keys are used by witnesses to sign blocks" /></div>
    <q-list bordered seperator dense>
        <q-item>
            <q-item-section avatar>
                <q-icon name="lock" color="blue-grey" />
            </q-item-section>
            <q-item-section class="wrap text-caption">
                {{ witness.signing_key }}
            </q-item-section>
            <q-item-section side>
                1
            </q-item-section>
        </q-item>
    </q-list>
  </q-card-section>
  <q-card-section>
    <div class="text-h6">Owner <q-icon name="info" color="info" title="This is the admin key, that gives rights to perform any kind of transaction." /></div>
    <q-list bordered seperator :dense="$q.screen.lt.md">
        <q-item v-for="auth in account.owner.key_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="lock" color="blue-grey" />
            </q-item-section>
            <q-item-section class="wrap text-caption">
                {{ auth[0] }}
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
        </q-item>
        <q-item v-for="auth in account.owner.account_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="person" color="primary"/>
            </q-item-section>
            <q-item-section>
                <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
            <q-item-section side v-if="loggedInUser === account.name && editorEnabled">
                <q-btn icon="delete" color="red" title="Remove owner authority" dense flat  @click="removeAuth('owner', 'account', account.name, auth[0])" />
            </q-item-section>
        </q-item>
        <q-item v-if="loggedInUser === account.name && editorEnabled">
            <q-btn flat style="margin: auto" title="Add owner authority" icon="person_add" color="green">
                <q-popup-proxy>
                    <q-card class="q-pa-md">
                        <q-card-section>
                            Give owner authority to this account :
                        </q-card-section>
                        <q-card-section>
                            <q-input label="account" v-model="newOwnerAuthAccount" />
                            <q-input label="weight" v-model="newOwnerAuthWeight" />
                        </q-card-section>
                        <q-card-actions>
                            <q-btn flat label="Add owner authority" icon="warning" color="orange" @click="addAuth('owner', 'account', account.name, newOwnerAuthAccount, newOwnerAuthWeight)" />
                        </q-card-actions>
                    </q-card>
                </q-popup-proxy>
            </q-btn>
        </q-item>
        Threshold: {{ account.owner.weight_threshold }}
    </q-list>
  </q-card-section>
  <q-card-section>
    <div class="text-h6">Active <q-icon name="info" color="info" title="The active key is needed to perform monetary transactions. It can also be used to change the other permissions (except for Owner)." /></div>
    <q-list bordered seperator :dense="$q.screen.lt.md" class="wrap">
        <q-item v-for="auth in account.active.key_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="lock" color="blue-grey"/>
            </q-item-section>
            <q-item-section class="wrap text-caption">
                {{ auth[0] }}
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
        </q-item>
        <q-item v-for="auth in account.active.account_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="person" color="primary" />
            </q-item-section>
            <q-item-section>
                <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
            <q-item-section side v-if="loggedInUser === account.name && editorEnabled">
                <q-btn icon="delete" color="red" title="Remove active authority" dense flat @click="removeAuth('active', 'account', account.name, auth[0])" />
            </q-item-section>
        </q-item>
        <q-item v-if="loggedInUser === account.name && editorEnabled">
            <q-btn style="margin: auto" title="Add active authority" icon="person_add" color="green" dense flat>
                <q-popup-proxy>
                    <q-card class="q-pa-md">
                        <q-card-section>
                            Give active authority to this account :
                        </q-card-section>
                        <q-card-section>
                            <q-input label="account" v-model="newActiveAuthAccount" />
                            <q-input label="weight" v-model="newActiveAuthWeight" />
                        </q-card-section>
                        <q-card-actions>
                            <q-btn label="Add active authority" icon="warning" color="orange" @click="addAuth('active', 'account', account.name, newActiveAuthAccount, newActiveAuthWeight)" />
                        </q-card-actions>
                    </q-card>
                </q-popup-proxy>
            </q-btn>
        </q-item>
      Threshold: {{ account.active.weight_threshold }}
    </q-list>
  </q-card-section>
  <q-card-section>
    <div class="text-h6">Posting <q-icon name="info" color="info" title="The posting key is used to post, vote and perform some broadcasts." /></div>
    <q-list bordered seperator :dense="$q.screen.lt.md">
        <q-item v-for="auth in account.posting.key_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="lock" color="blue-grey" />
            </q-item-section>
            <q-item-section class="wrap text-caption">
                {{ auth[0] }}
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
        </q-item>
        <q-item v-for="auth in account.posting.account_auths" :key="auth.index">
            <q-item-section avatar>
                <q-icon name="person" color="primary" />
            </q-item-section>
            <q-item-section>
                <router-link :to="accountLink(auth[0])">{{ auth[0] }}</router-link>
            </q-item-section>
            <q-item-section side>
                {{ auth[1] }}
            </q-item-section>
            <q-item-section side v-if="loggedInUser === account.name && editorEnabled">
                <q-btn icon="delete" color="red" title="Remove posting authority" dense flat @click="removeAuth('posting', 'account', account.name, auth[0])" />
            </q-item-section>
        </q-item>
        <q-item v-if="loggedInUser === account.name && editorEnabled">
            <q-btn style="margin: auto" title="Add posting authority" icon="person_add" color="green" dense flat>
                <q-popup-proxy>
                    <q-card class="q-pa-md">
                        <q-card-section>
                            Give posting authority to this account :
                        </q-card-section>
                        <q-card-section>
                            <q-input label="account" v-model="newPostingAuthAccount" />
                            <q-input label="weight" v-model="newPostingAuthWeight" />
                        </q-card-section>
                        <q-card-actions>
                            <q-btn label="Add posting authority" size="1rem" icon="warning" color="orange" @click="addAuth('posting', 'account', account.name, newPostingAuthAccount, newPostingAuthWeight)" />
                        </q-card-actions>
                    </q-card>
                </q-popup-proxy>
            </q-btn>
        </q-item>
        Threshold: {{ account.posting.weight_threshold }}
    </q-list>
  </q-card-section>
  <q-card-section>
    <div class="text-h6">Memo <q-icon name="info" color="info" title="Use to encode/decode private memos." /></div>
    <q-list bordered seperator :dense="$q.screen.lt.md">
        <q-item>
            <q-item-section avatar>
                <q-icon name="lock" color="blue-grey"/>
            </q-item-section>
            <q-item-section class="wrap text-caption">
                {{ account.memo_key }}
            </q-item-section>
            <q-item-section side>
                1
            </q-item-section>
        </q-item>
    </q-list>
  </q-card-section>
</q-card>
</template>
<script>
import { keychain } from '@hiveio/keychain'
export default {
  name: 'accountAuthorities',
  props: ['account', 'witness'],
  data () {
    return {
      dialogAddAccountAuth: false,
      editorEnabled: false,
      newPostingAuthAccount: '',
      newPostingAuthWeight: 1,
      newActiveAuthAccount: '',
      newActiveAuthWeight: 1,
      newOwnerAuthAccount: '',
      newOwnerAuthWeight: 1,
      newMemoAuthAccount: '',
      newMemoAuthWeight: 1
    }
  },
  methods: {
    accountLink (username) { return '/@' + username },
    async removeAuth (keyType, authType, accountToModify, toRemove) {
      if (authType === 'account') {
        console.log('remove ' + keyType + ' ' + authType + ' authority of ' + toRemove + ' over account ' + accountToModify)
        const { success, msg } = await keychain(window, 'requestRemoveAccountAuthority', accountToModify, toRemove, keyType)
        if (success) {
          this.$emit('authEdited')
          console.log(msg)
        }
      }
    },
    async addAuth (keyType, authType, accountToModify, toAdd, weight) {
      if (authType === 'account') {
        console.log('add ' + keyType + ' ' + authType + ' authority of ' + toAdd + ' over account ' + accountToModify)
        const { success, msg } = await keychain(window, 'requestAddAccountAuthority', accountToModify, toAdd, keyType, weight)
        if (success) {
          this.$emit('authEdited')
          console.log(msg)
        }
      }
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username }
    }
  }
}
</script>
