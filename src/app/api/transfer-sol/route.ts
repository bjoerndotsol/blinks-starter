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

type TransferInstructionParams = {
  receiver: PublicKey;
  amount: number;
  payer: PublicKey;
};

/**
 * Create standardized headers for Solana Actions API endpoints
 * These headers handle:
 * - CORS (Cross-Origin Resource Sharing) to allow requests from Blink clients
 * - Content-Type settings for JSON responses
 * - Security headers like CORS preflight requests
 * - API versioning headers if configured
 */
const headers = createActionHeaders();

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

/**
 * GET endpoint defines the Action metadata that describes:
 * - How the Action appears in Blink clients
 * - What parameters users need to provide
 * - How the Action should be executed
 */
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

/**
 * OPTIONS endpoint is required for CORS preflight requests
 * Browsers send these requests before actual API calls to check:
 * - If the server allows requests from the client's origin
 * - Which HTTP methods are allowed (GET, POST, etc.)
 * - Which headers can be included in the actual request
 */
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

/**
 * POST endpoint handles the actual transaction creation
 * This endpoint:
 * - Validates the transfer parameters from the request
 * - Creates a Solana transaction for SOL transfer
 * - Returns the serialized transaction for signing
 */
export const POST = async (req: Request) => {
  try {
    const { receiver, amount, payer } = await verifyTransferInstruction(req);

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

/**
 * Prepares a Solana transaction for transferring SOL between accounts
 * @param connection - The Solana network connection
 * @param payer - Public key of the account sending SOL
 * @param receiver - Public key of the account receiving SOL
 * @param amount - Amount of SOL to transfer
 * @returns A VersionedTransaction ready to be signed and sent
 */
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

/**
 * Validates and extracts transfer instruction parameters from the request
 * @param req - The incoming HTTP request
 * @returns Promise resolving to validated transfer parameters
 * @throws Error if required parameters are missing or invalid
 */
const verifyTransferInstruction = async (
  req: Request
): Promise<TransferInstructionParams> => {
  return new Promise(async (resolve, reject) => {
    try {
      const url = new URL(req.url);
      const request: ActionPostRequest = await req.json();

      const receiverString = url.searchParams.get("receiver");
      if (!receiverString) {
        throw new Error("Receiver address is required");
      }

      const amountString = url.searchParams.get("amount");
      if (!amountString) {
        throw new Error("Amount is required");
      }

      if (!request.account) {
        throw new Error("Payer account is required");
      }

      const result = {
        receiver: new PublicKey(receiverString),
        amount: Number(amountString),
        payer: new PublicKey(request.account),
      };

      resolve(result);
    } catch (error: unknown) {
      console.error(error);
      reject(`Invalid transfer instruction: ${(error as Error).message}`);
    }
  });
};
