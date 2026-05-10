import {NodeJSSerialConnection, Constants} from "@liamcottle/meshcore.js";
import * as process from "node:process";
import {ButtplugClient, consoleLogger, Device} from "@zendrex/buttplug.js";

const client = new ButtplugClient(process.env.WS_ENDPOINT, {
    logger: consoleLogger,
    autoReconnect: true,
    reconnectDelay: 1000,       // initial delay
    maxReconnectDelay: 30000,   // backoff cap
    maxReconnectAttempts: 10,
});

// @ts-ignore
await client.connect();

client.on("deviceAdded", async ({data: {device}}) => {
    console.log(`Found: ${device.displayName ?? device.name}`);

    if (device.canOutput("Vibrate")) {
        await device.vibrate(0.5);
        setTimeout(() => device.stop(), 2000);
    }
});

await client.startScanning();

// Check for environment variables
if (!process.env.SERIAL_PORT) {
    throw new Error("Missing SERIAL_PORT");
}

// Create connection to companion radio
const connection = new NodeJSSerialConnection(process.env.SERIAL_PORT);

// Initial Setup
const channelNames: string[] = [];

connection.on("connected", async () => {
    console.log("Connected to radio");
    const channels = await connection.getChannels();

    for (const channel of channels) {
        channelNames[channel.channelIdx] = channel.name;
    }
});

const divideReply = (message: string) => {
    // 146 (max channel message size) - 4 (region scope) - 32 (max name size) - 3 (mandatory channel message characters)
    const MAX_LENGTH = 148;
    let messageLength = message.length;
    let messageCount = 1;

    while (messageLength > MAX_LENGTH) {
        messageCount = messageCount + 1;
        messageLength = Math.ceil(messageLength / messageCount);
    }

    // return early if no split needed
    if (messageCount === 1) {
        return [message];
    }

    const segmenter = new Intl.Segmenter(process.env.LANGUAGE_CODE ?? "en", {granularity: "word"});
    const words = Array.from(segmenter.segment(message));

    const replies: string[] = [];
    let currentReplyIndex = 0;

    words.forEach(({segment}) => {
        if (
            replies[currentReplyIndex]?.length &&
            replies[currentReplyIndex].length + segment.length > messageLength
        ) {
            currentReplyIndex = currentReplyIndex + 1;
        }
        replies[currentReplyIndex] = (replies[currentReplyIndex] ?? "") + segment;
    });

    return replies;
};

const commands = ['stop', 'vibrate', 'rotate', 'position', 'oscillate', 'constrict', 'spray'];

const help = async (channelIdx: number, params: string[]) => {
    let reply = '';
    if (params.length === 0) {
        reply = `Commands:\n${commands.join('\n')}`;
    } else {
        switch (params[0]) {
            case 'stop':
                reply = 'Stops activity on connected devices.\nstop';
                break;
            case 'vibrate':
                reply = 'Sets vibration on connected devices. Optional intensity between 0 and 100. Optional duration in seconds.\nvibrate\nvibrate [intensity]\nvibrate [intensity] [duration]';
                break;
            case 'rotate':
                break;
            case 'position':
                break;
            case 'oscillate':
                reply = 'Sets oscillation on connected devices. Optional speed between 0 and 100. Optional duration in seconds.\noscillate\noscillate [speed]\noscillate [speed] [duration]';
                break;
        }
    }

    const replies = divideReply(reply);
    await Promise.all(
        replies.map((replyPart, index) => {
            setTimeout(
                async () => {
                    await connection.sendChannelTextMessage(channelIdx, replyPart);
                },
                (index + 1) * 2000,
            );
        }),
    );
}

const stop = async (device: Device) => {
    await device.stop();
}

const vibrate = async (device: Device, params: string[]) => {
    let intensity = 1;
    let duration: number;

    if (params[0]) {
        const parsedIntensity = parseInt(params[0]) ?? 0;
        if (parsedIntensity >= 0 && parsedIntensity <= 100) {
            intensity = parsedIntensity / 100
        }
    }

    if (params[1]) {
        const parsedDuration = parseInt(params[1]) ?? 0;
        if (parsedDuration >= 0) {
            duration = parsedDuration * 1000;
        }
    }

    if (device.canOutput("Vibrate")) {
        await device.vibrate(intensity);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

const oscillate = async (device: Device, params: string[]) => {
    let speed = 1;
    let duration: number;

    if (params[0]) {
        const parsedSpeed = parseInt(params[0]) ?? 0;
        if (parsedSpeed >= 0 && parsedSpeed <= 100) {
            speed = parsedSpeed / 100
        }
    }

    if (params[1]) {
        const parsedDuration = parseInt(params[1]) ?? 0;
        if (parsedDuration >= 0) {
            duration = parsedDuration * 1000;
        }
    }

    if (device.canOutput("Oscillate")) {
        await device.oscillate(speed);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

connection.on(Constants.PushCodes.MsgWaiting, async () => {
    try {
        const waitingMessages = await connection.getWaitingMessages();

        for (const message of waitingMessages) {
            // Do not show DMs
            if (message.channelMessage) {
                // send channel messages
                const packet = {
                    ...message.channelMessage,
                    channelName: channelNames[message.channelMessage.channelIdx],
                }
                if (packet.channelName === "#buttplug") {
                    console.log(packet);

                    const separatorIndex = packet.text.trim().indexOf(":");
                    const cleanedMessage: string = packet.text.slice(separatorIndex + 2).toLowerCase();
                    const [command, ...params] = cleanedMessage.split(" ");

                    if (command === "help") {
                        await help(packet.channelIdx, params);
                    } else {
                        if (client.devices.length) {
                            client.devices.forEach((device) => {
                                switch (command) {
                                    case 'stop':
                                        stop(device);
                                        break;
                                    case 'vibrate':
                                        vibrate(device, params);
                                        break;
                                    case 'rotate':
                                        break;
                                    case 'position':
                                        break;
                                    case 'oscillate':
                                        oscillate(device, params);
                                        break;
                                    case 'constrict':
                                        break;
                                    case 'spray':
                                        break;
                                    default:
                                        console.log('Ignoring Message');
                                }
                            });
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
});

connection.on("disconnected", async () => {
    console.log("Disconnected");
    await connection.connect();
});

// Connect to companion
connection.connect();
