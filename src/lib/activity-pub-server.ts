import ky, {type KyInstance} from "ky";
import ms from "ms";
import * as crypto from 'crypto';
import type {Activity} from "../types/activity-pub/activity.ts";
import type {Actor} from "../types/activity-pub/actor.ts";

class RequestSigner {
    public sign(
        headers: Record<string, string>,
        pathAndQuery: string,
        body: string,
        privateKey: string,
        keyId: string,
    ): Record<string, string> {
        const headersToUse: Record<string, string> = {};

        const hasher = crypto.createHash('SHA256');
        hasher.update(body);

        for (const headerName of Object.keys(headers)) {
            headersToUse[headerName.toLowerCase()] = headers[headerName];
        }
        headersToUse['(request-target)'] = `post ${pathAndQuery}`;
        headersToUse['digest'] = `SHA-256=${hasher.digest('base64')}`;

        const signingParts: string[] = [];
        for (const headerName of Object.keys(headersToUse)) {
            signingParts.push(`${headerName}: ${headers[headerName]}`);
        }
        const stringToSign = signingParts.join("\n");

        const signer = crypto.createSign('SHA256');
        signer.update(stringToSign);
        signer.end();

        const signature = signer.sign(privateKey, 'base64');
        const signatureHeader = `keyId="${keyId}",algorithm="hs2019",headers="${Object.keys(headers).join(' ')}",signature="${signature}"`;

        const result = {...headersToUse};
        delete result['(request-target)'];
        result['signature'] = signatureHeader;

        return result;
    }
}

export class ActivityPubSender {
    private httpClient: KyInstance | null = null;
    private readonly requestSigner = new RequestSigner();

    public async sendActivity(activity: Activity<string>, privateKey: string): Promise<boolean> {
        const httpClient = this.getHttpClient();
        const sender = await this.fetchActor(activity.actor);
        const recipient = await this.fetchActor(activity.to as string);

        const inboxUrl = new URL(recipient.inbox);
        let inboxPathAndQuery = inboxUrl.pathname;
        if (inboxUrl.search) {
            inboxPathAndQuery += `?${inboxUrl.search}`;
        }

        const body = JSON.stringify(activity);
        let headers = this.requestSigner.sign({
            'content-type': 'application/activity+json',
            'date': new Date().toUTCString(),
            'host': new URL(recipient.inbox).host,
        }, inboxPathAndQuery, body, privateKey, sender.publicKey.id);

        const response = await httpClient.post(recipient.inbox, {
            body: body,
            headers: headers,
        });

        return response.status >= 200 && response.status < 300;
    }

    private async fetchActor(actorId: string): Promise<Actor<string>> {
        return this.getHttpClient().get<Actor<string>>(actorId).json();
    }

    private getHttpClient(): KyInstance {
        this.httpClient ??= ky.create({
            timeout: ms("1 minutes"),
            retry: 1,
            headers: {
                Accept: "application/activity+json",
            },
        });

        return this.httpClient;
    }
}
