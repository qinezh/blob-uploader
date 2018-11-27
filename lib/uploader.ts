import * as path from "path";
import {
    Aborter,
    BlockBlobURL,
    ContainerURL,
    SharedKeyCredential,
    ServiceURL,
    StorageURL,
    uploadFileToBlockBlob
} from "@azure/storage-blob";
import * as util from "util";
const glob = util.promisify(require('glob'));

const ABORTER = Aborter.timeout(10 * 60 * 1000);

module.exports = class uploader {
    private option: UploadOption;

    constructor(option: UploadOption) {
        if (!option.accountName) {
            throw new Error("Account name of azure storage can't be null.");
        }
        if (!option.containerName) {
            throw new Error("Container name of azure blob can't be null.");
        }
        if (!option.accessKey) {
            throw new Error("Access key to azure storage can't be null.");
        }

        this.option = option;
    }

    public async uploadFile(filePath: string): Promise<void> {
        const containerURL = await this.createContainer();
        filePath = path.resolve(filePath);
        const fileName = path.basename(filePath);
        const blockBlobURL = BlockBlobURL.fromContainerURL(containerURL, fileName);

        await uploadFileToBlockBlob(ABORTER, filePath, blockBlobURL);
    }

    public async uploadFiles(pattern: string): Promise<void> {
        const matches = await glob(pattern);
        for (const match of matches) {
            await this.uploadFile(match);
            console.log(`${match} uploaded.`);
        }
    }

    private async createContainer() {
        const serviceURL = this.createServiceURL();
        const containerURL = ContainerURL.fromServiceURL(serviceURL, this.option.containerName);

        const existed = await this.isExist(serviceURL, this.option.containerName);
        if (!existed) {
            await containerURL.create(ABORTER);
            console.log(`New container "${this.option.containerName}" is created.`);
        }

        return containerURL;
    }

    private createServiceURL() {
        const credentials = new SharedKeyCredential(this.option.accountName, this.option.accessKey);
        const pipeline = StorageURL.newPipeline(credentials);
        return new ServiceURL(`https://${this.option.accountName}.blob.core.windows.net`, pipeline);
    }

    private async isExist(serviceURL: ServiceURL, containerName: string): Promise<boolean> {
        let response;
        let marker;

        do {
            response = await serviceURL.listContainersSegment(ABORTER, marker);
            marker = response.marker;
            for (const container of response.containerItems) {
                if (containerName === container.name) {
                    return true;
                }
            }
        } while (marker);

        return false;
    }
}

interface UploadOption {
    accountName: string,
    accessKey: string,
    containerName: string
}
