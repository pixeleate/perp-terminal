import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Banner, Button, Card, KeyValue, Pill, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/privy/AuthProvider';
import { colors, fonts } from '@/lib/theme';

const FIELD_LABEL = 'font-semibold text-caption tracking-[0.4px] text-fg-muted';
const MONO = { fontFamily: fonts.mono, fontSize: 11 };

export function PrivyCard() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const busy = auth.otpStatus === 'sending-code' || auth.otpStatus === 'submitting-code';
  const awaitingCode = auth.otpStatus === 'awaiting-code-input' || auth.otpStatus === 'submitting-code';

  return (
    <View>
      <SectionTitle hint={auth.mode === 'privy' ? 'real SDK' : 'stub'}>Privy auth</SectionTitle>

      {auth.mode === 'stub' ? (
        <View className="mb-2">
          <Banner
            tone="warn"
            title="RUNNING THE STUB"
            body={`${auth.stubReason ?? 'Privy is not configured.'} The flow below mirrors the real hook surface; use code 123456.`}
          />
        </View>
      ) : null}

      <Card>
        {auth.user ? (
          <View className="gap-2">
            <View className="flex-row">
              <Pill label={auth.mode === 'privy' ? 'Authenticated' : 'Stub session'} tone="up" />
            </View>
            <View>
              <KeyValue label="User ID" value={auth.user.id} valueStyle={MONO} />
              <KeyValue divider label="Email" value={auth.user.email ?? '—'} />
              <KeyValue
                divider
                label="Linked accounts"
                value={auth.user.linkedAccounts.join(', ') || '—'}
              />
              {auth.wallets.map((wallet) => (
                <KeyValue
                  key={wallet.chain}
                  divider
                  label={`${wallet.chain} wallet`}
                  value={wallet.address ?? wallet.status}
                  valueStyle={MONO}
                />
              ))}
            </View>

            <View className="mt-2 flex-row gap-2">
              {auth.mode === 'privy' && !auth.wallets.find((w) => w.chain === 'solana')?.address ? (
                <Button
                  variant="accent"
                  label="Create Solana wallet"
                  className="flex-1"
                  onPress={() => void auth.createSolanaWallet()}
                  accessibilityLabel="Create embedded Solana wallet"
                />
              ) : null}
              <Button
                label="Log out"
                className="flex-1"
                onPress={() => void auth.logout()}
                accessibilityLabel="Log out"
              />
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Text className={FIELD_LABEL}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!awaitingCode}
              className="rounded-md border border-line bg-raised px-3 py-3 font-regular text-base text-fg"
              accessibilityLabel="Email address"
              testID="privy-email"
            />

            {awaitingCode ? (
              <>
                <Text className={FIELD_LABEL}>One-time code</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  className="rounded-md border border-line bg-raised px-3 py-3 font-regular text-base text-fg"
                  accessibilityLabel="One-time code"
                  testID="privy-code"
                />
              </>
            ) : null}

            {auth.error ? <Text className="font-regular text-xs text-down">{auth.error}</Text> : null}

            <Button
              variant="accent"
              label={busy ? 'Working…' : awaitingCode ? 'Verify code' : 'Send login code'}
              disabled={busy || (awaitingCode ? code.length < 4 : !email.includes('@'))}
              onPress={() =>
                awaitingCode ? void auth.loginWithCode(code) : void auth.sendCode(email.trim())
              }
              accessibilityLabel={awaitingCode ? 'Verify code' : 'Send login code'}
              accessibilityState={{ busy }}
              testID="privy-submit"
            />
          </View>
        )}
      </Card>
    </View>
  );
}
