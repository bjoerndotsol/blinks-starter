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

// Create standardized headers for Blink Providers
const headers = createActionHeaders();

// Create a connection to the Solana Devnet
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// GET endpoint defines the Blink metadata which is used
// to display the Blink in Blink clients
export const GET = async (req: Request) => {
  const response: ActionGetResponse = {
    // Identifies this as a Blink
    type: "action",
    // Icon displayed in Blink clients
    icon: `${new URL("/transfer-sol.png", req.url).toString()}`,
    // Short label for the Blink
    label: "Send SOL",
    // Full title shown in the Blink details
    title: "Send SOL with a Blink",
    // Detailed description with Markdown support
    description:
      "This Blink demonstrates how to send SOL on the Solana blockchain. It is a part of the official Blink Starter Guides by Dialect Labs.  \n\nLearn how to build this Blink: https://dialect.to/docs/guides/transfer-sol",
    // If you have multiple inputs
    links: {
      actions: [
        {
          // Defines this as a blockchain transaction
          type: "transaction",
          label: "Send SOL",
          // Dynamic URL with parameter placeholders
          href: "/api/transfer-sol?receiver={receiver}&amount={amount}",
          // Required user inputs
          parameters: [
            {
              // Type of input field
              type: "text",
              // Label shown in Blink client
              label: "Recipient Public Key",
              // Name of the parameter
              name: "receiver",
              // Whether the parameter is required
              required: true,
            },
            {
              // Type of input field
              type: "number",
              // Label shown in Blink client
              label: "Amount",
              // Name of the parameter
              name: "amount",
              // Whether the parameter is required
              required: true,
            },
          ],
        },
      ],
    },
  };

  // Return the response with proper headers
  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
};

// OPTIONS endpoint is required for CORS requests
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST endpoint handles the actual transaction creation
export const POST = async (req: Request) => {
  try {
    // Extract parameters from the URL
    const url = new URL(req.url);
    // Receiver public key is passed in the URL
    const receiver = new PublicKey(url.searchParams.get("receiver")!);
    // Amount of SOL to transfer is passed in the URL
    const amount = Number(url.searchParams.get("amount"));

    // Payer public key is passed in the request body
    const request: ActionPostRequest = await req.json();
    const payer = new PublicKey(request.account);

    // Prepare the transaction
    const transaction = await prepareTransaction(
      connection,
      payer,
      receiver,
      amount
    );

    // Create a response with the serialized transaction
    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
    };

    // Return the response with proper headers
    return Response.json(response, { status: 200, headers });
  } catch (error) {
    // Log and return an error response
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  }
};

// Prepares a Solana transaction for transferring SOL between accounts
const prepareTransaction = async (
  connection: Connection,
  payer: PublicKey,
  receiver: PublicKey,
  amount: number
) => {
  // Create a transfer instruction
  const instruction = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: new PublicKey(receiver),
    lamports: amount * LAMPORTS_PER_SOL,
  });

  // Get the latest blockhash
  const { blockhash } = await connection.getLatestBlockhash();

  // Create a transaction message
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  // Create and return a versioned transaction
  return new VersionedTransaction(message);
};
