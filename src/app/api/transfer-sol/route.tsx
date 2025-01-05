import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  createActionHeaders,
} from "@solana/actions";

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const headers = createActionHeaders();

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export const GET = async (req: Request) => {
  const response: ActionGetResponse = {
    type: "action",
    icon: "http://localhost:3000/transfer-sol.png",
    label: "Send SOL",
    title: "Send SOL to a friend",
    description: "Send SOL to a friend using their public key.",
    links: {
      actions: [
        {
          type: "transaction",
          label: "Send SOL",
          href: "/api/transfer-sol?receiver={receiver}&amount={amount}",
          parameters: [
            {
              type: "text",
              label: "Recipient Public Key",
              name: "receiver",
              required: true,
            },
            {
              type: "number",
              label: "Amount",
              name: "amount",
              required: true,
            },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
};

// OPTIONS are used to enable CORS for Blinks
export const OPTIONS = async (req: Request) => {
  return new Response(null, { headers });
};

export const POST = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const receiverString = url.searchParams.get("receiver");
    const receiver = new PublicKey(receiverString!);
    const amount: number = Number(url.searchParams.get("amount"));

    const request: ActionPostRequest = await req.json();
    const payer: PublicKey = new PublicKey(request.account);

    // print the params
    console.log(":: RECEIVED PARAMETERS ::");
    console.log({ receiver, amount, payer });

    if (!receiver || !amount) {
      return new Response(null, { status: 400, headers });
    }

    const transaction = await prepareTransaction(
      connection,
      payer,
      receiver,
      amount
    );

    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
    };

    return Response.json(response, { status: 200, headers });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
};

const prepareTransaction = async (
  connection: Connection,
  payer: PublicKey,
  receiver: PublicKey,
  amount: number
) => {
  const instruction = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: new PublicKey(receiver),
    lamports: amount * LAMPORTS_PER_SOL,
  });

  const { blockhash } = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  return new VersionedTransaction(message);
};
