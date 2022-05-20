import type { NextApiRequest, NextApiResponse } from "next";
import Web3 from "web3";
//@ts-ignore
import Web3Quorum from "web3js-quorum";
import apiAuth from "../../common/lib/authentication";
import { CompiledContract } from "../../common/types/Contracts";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const checkSession = await apiAuth(req, res);
  if (!checkSession) {
    return;
  }
  console.log(req.body);
  if (req.body.client === "besu") {
    await besuReadValueAtAddress(
      // still needs to be updated with proper values
      req.body.rpcUrl,
      req.body.contractAddress,
      req.body.compiledContract,
      req.body.fromPrivateKey,
      req.body.privateFrom,
      req.body.privateFor,
      req.body.functionToCall
    ).then((value) => {
      res.status(200).json(value);
    });
  } else if (req.body.client === "goquorum") {
    await readValueAtAddress(
      req.body.client,
      req.body.rpcUrl,
      req.body.privateUrl,
      req.body.contractAddress,
      req.body.compiledContract,
      req.body.functionToCall
    ).then((value) => {
      res.status(200).json(value);
    });
  }
}

async function readValueAtAddress(
  client: string,
  rpcUrl: string,
  privateUrl: string,
  contractAddress: string,
  compiledContract: CompiledContract,
  functionToCall: string
) {
  console.log("calling contract function: " + functionToCall);
  const abi = compiledContract.abi;
  const web3 = new Web3(rpcUrl);
  const web3quorum = Web3Quorum(web3, { privateUrl: privateUrl }, true);
  const contractInstance = new web3quorum.eth.Contract(abi, contractAddress);
  // contractInstance.defaultCommon.customChain = {name: 'GoQuorum', chainId: 1337};
  const res = await contractInstance.methods[functionToCall]().call().catch(console.error);
  
  console.log("obtained value at deployed contract is: " + res);
  return res;
}

async function besuReadValueAtAddress(
  rpcUrl: string,
  contractAddress: string,
  compiledContract: CompiledContract,
  fromPrivateKey: string,
  fromPublicKey: string,
  toPublicKey: string[],
  functionToCall: string
) {
  console.log("calling contract function: " + functionToCall);
  const web3 = new Web3(rpcUrl);
  const chainId = await web3.eth.getChainId();
  const web3quorum = new Web3Quorum(web3, chainId);
  const contract = new web3quorum.eth.Contract(compiledContract.abi);
  // eslint-disable-next-line no-underscore-dangle
  const functionAbi = contract._jsonInterface.find((e: any) => {
    return e.name === functionToCall;
  });
  console.log("Function ABI: " + JSON.stringify(functionAbi))
  const funcOutputType = functionAbi.outputs[0].type;
    const functionParams = {
    to: contractAddress,
    data: functionAbi.signature,
    privateKey: fromPrivateKey.slice(2),
    privateFrom: fromPublicKey,
    privateFor: toPublicKey,
  };
  console.log(functionParams);
  const transactionHash = await web3quorum.priv.generateAndSendRawTransaction(
    functionParams
  );
  console.log(`Transaction hash: ${transactionHash}`);
  const result = await web3quorum.priv.waitForTransactionReceipt(
    transactionHash
  );
  const outputSimplified = web3.eth.abi.decodeParameters([funcOutputType],result.output)
  console.log("Raw value from deployed contract is: " + result.output );
  console.log("Type to decode is: " + funcOutputType );
  console.log("Value from deployed contract is: " );
  console.log(outputSimplified)
  return outputSimplified[0];
}
