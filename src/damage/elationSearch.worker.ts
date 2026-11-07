import {
	type EvaluationReply,
	type EvaluationRequest,
	evaluateAxis,
} from "./elationSearchEvaluation";

self.onmessage = (event: MessageEvent<EvaluationRequest>) => {
	const { id, config, job } = event.data;
	let reply: EvaluationReply;
	try {
		reply = { id, stats: evaluateAxis(config, job) };
	} catch (error) {
		reply = {
			id,
			error: error instanceof Error ? error.message : String(error),
		};
	}
	self.postMessage(reply);
};
