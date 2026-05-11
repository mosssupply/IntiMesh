import {NodeJSSerialConnection, Constants} from "@liamcottle/meshcore.js";
import * as process from "node:process";
import {ButtplugClient, consoleLogger} from "@zendrex/buttplug.js";
import {stop, vibrate, oscillate, constrict, temperature, rotate, position, spray} from "./commands";

const client = new ButtplugClient(process.env.WS_ENDPOINT, {
    logger: consoleLogger,
    autoReconnect: true,
    reconnectDelay: 1000,       // initial delay
    maxReconnectDelay: 30000,   // backoff cap
    maxReconnectAttempts: 10,
});

client.on("deviceAdded", async ({data: {device}}) => {
    console.log(`Found: ${device.displayName ?? device.name}`);

    if (device.canOutput("Vibrate")) {
        await device.vibrate(0.5);
        setTimeout(async () => await device.stop(), 1000);
    }
});

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

    // Connect ButtplugClient
    await client.connect();

    await client.startScanning();
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

const commands = ['stop', 'vibrate', 'rotate', 'position', 'oscillate', 'constrict', 'temperature', 'spray'];

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
                reply = 'Sets vibration on connected devices.\nvibrate\nvibrate [intensity 0-100]\nvibrate [intensity 0-100] [duration (s)]';
                break;
            case 'rotate':
                reply = 'Sets rotation on connected devices.\nrotate\nrotate [clockwise|anticlockwise]\nrotate [clockwise|anticlockwise] [duration (s)]';
                break;
            case 'position':
                reply = 'Sets position on connected devices.\nposition [percent 0-100] [duration (s)]'
                break;
            case 'oscillate':
                reply = 'Sets oscillation on connected devices.\noscillate\noscillate [speed 0-100]\noscillate [speed 0-100] [duration (s)]';
                break;
            case 'constrict':
                reply = 'Sets constriction on connected devices.\nconstrict\nconstrict [pressure 0-100]\nconstrict [pressure 0-100] [duration (s)]';
                break;
            case 'temperature':
                reply = 'Sets temperature on connected devices.\ntemperature [percent 0-100]\ntemperature [percent 0-100] [duration (s)]';
            case 'spray':
                reply = 'Sets spray output on connected devices.\nspray\nspray [output 0-100]\nspray [output 0-100] [duration(s)]';
                break;
            default:
                reply = `Commands:\n${commands.join('\n')}`;
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
                                    case 'oscillate':
                                        oscillate(device, params);
                                        break;
                                    case 'constrict':
                                        constrict(device, params);
                                        break;
                                    case 'spray':
                                        spray(device, params);
                                        break;
                                    case 'temperature':
                                        temperature(device, params);
                                        break;
                                    case 'rotate':
                                        rotate(device, params);
                                        break;
                                    case 'position':
                                        position(device, params);
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
