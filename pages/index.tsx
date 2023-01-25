import Head from "next/head";
import { Center, Container, Button, useToast } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import { useChain } from "@cosmos-kit/react";
import { WalletSection } from "../components";
import { useMutation } from "react-query";
import {
  createMessageSend,
  createTxIBCMsgTransfer,
} from "@tharsis/transactions";
import { decodePubkey } from "@cosmjs/proto-signing";

const TIMEOUT_TIMESTAMP = 5 * 60 * 1000 * 1000 * 1000;

const IBC_AMOUNT = 0.1;

export const generateIbcTimeoutTimestamp = () => {
  return new Date().getTime() * 1_000_000 + TIMEOUT_TIMESTAMP;
};

const convertDenomToMicroDenom = (value: number, multiplier: number = 1e6) => {
  return new BigNumber(value).multipliedBy(multiplier).toNumber();
};

const convertMicroDenomToDenom = (value: number, multiplier: number = 1e6) => {
  return new BigNumber(value).dividedBy(multiplier).toNumber();
};

export default function Home() {
  const stride = useChain("stride");

  const evmos = useChain("evmos");

  const toast = useToast();

  const handleMutation = async () => {
    if (!evmos.address || !stride.address) {
      throw new Error("Missing relevant addresses");
    }

    const fee = {
      amount: [
        {
          amount: "0",
          denom: "aevmos",
        },
      ],
      gas: String(convertDenomToMicroDenom(0.25)),
    };

    console.log(fee);

    // const msgTransfer = {
    //   typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    //   value: {
    //     sourcePort: "transfer",
    //     sourceChannel: "channel-25",
    //     token: {
    //       amount: String(convertDenomToMicroDenom(IBC_AMOUNT, 1e18)),
    //       denom: "aevmos",
    //     },
    //     sender: evmos.address,
    //     receiver: stride.address,
    //     timeoutTimestamp: generateIbcTimeoutTimestamp(),
    //   },
    // };

    const client = await evmos.getSigningStargateClient();

    console.log("Client", client);

    const { accountNumber, sequence } = await client.getSequence(evmos.address);

    // Not working
    const offlineSigner = await evmos.getOfflineSigner();

    console.log("Offline signer", offlineSigner);

    const accounts = await offlineSigner.getAccounts();

    const account = accounts.find((account) => {
      return account.address === evmos.address;
    });

    if (!account) {
      throw new Error("Account could not be found");
    }

    const message = createTxIBCMsgTransfer(
      {
        chainId: 9001,
        cosmosChainId: evmos.chain.chain_id,
      },
      {
        accountAddress: evmos.address,
        sequence,
        accountNumber,
        pubkey: account.pubkey.toString(),
      },
      {
        amount: "0",
        denom: "aevmos",
        gas: "200000",
      },
      "",
      {
        sourcePort: "transfer",
        sourceChannel: "channel-25",
        amount: String(convertDenomToMicroDenom(IBC_AMOUNT, 1e18)),
        denom: "aevmos",
        receiver: stride.address,
        revisionNumber: 0,
        revisionHeight: 0,
        timeoutTimestamp: generateIbcTimeoutTimestamp().toString(),
      }
    );

    console.log("message", message);

    // @ts-ignore
    await window.keplr.signDirect(
      evmos.chain.chain_id,
      evmos.address,
      message.signDirect
    );

    // const message = createMessageSend({
    //   chainId: 9001,
    //   cosmosChainId: evmos.chain.chain_id
    // }, {
    //   accountAddress: evmos.address,
    //   sequence,
    //   accountNumber,
    //   pubkey: account.pubkey
    // }, {
    //   amount: '0',
    //   denom :'aevmos',
    //   gas: '200000'
    // }, '', {
    //   destinationAddress: ''
    // })

    // await client.signAndBroadcast(evmos.address, [msgTransfer], fee, "");
  };

  const handleSuccess = () => {
    toast({ title: "IBC success", status: "success" });
  };

  const handleError = () => {
    toast({ title: "IBC error", status: "error" });
  };

  const { mutate, isLoading } = useMutation(handleMutation, {
    onSuccess: handleSuccess,
    onError: handleError,
  });

  return (
    <Container maxW="5xl" py={10}>
      <Head>
        <title>Issue: Evmos IBC</title>
      </Head>

      <WalletSection />

      {evmos.status === "Connected" && stride.status === "Connected" && (
        <Center>
          <Button
            isLoading={isLoading}
            loadingText="Transferring"
            onClick={() => mutate()}
          >
            IBC Transfer {IBC_AMOUNT} to Stride
          </Button>
        </Center>
      )}
    </Container>
  );
}
