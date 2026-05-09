import {NodeJSSerialConnection, Constants, Message} from "@liamcottle/meshcore.js";
import * as process from "node:process";
import { ButtplugClient, consoleLogger } from "@zendrex/buttplug.js";

const client = new ButtplugClient(process.env.WS_ENDPOINT, {
	logger: consoleLogger,
	autoReconnect: true,
	reconnectDelay: 1000,       // initial delay
	maxReconnectDelay: 30000,   // backoff cap
	maxReconnectAttempts: 10,
});

// @ts-ignore
await client.connect();

client.on("deviceAdded", async ({ data: { device } }) => {
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
					const [command, intensityString, durationString] = cleanedMessage.split(" ");

					if (command === "help") {
						await connection.sendChannelTextMessage(packet.channelIdx, "Commands:\nvibrate [intensity] [duration]\nstop");
					} else {
						let intensity = 1;
						let duration: number;

						if (intensityString) {
							const parsedIntensity = parseInt(intensityString) ?? 0;
							if (parsedIntensity >= 0 && parsedIntensity <= 100) {
								intensity = parsedIntensity / 100
							}
						}

						if (durationString) {
							const parsedDuration = parseInt(durationString) ?? 0;
							if (parsedDuration >= 0) {
								duration = parsedDuration * 1000;
							}
						}

						if (client.devices.length) {
							client.devices.forEach((device) => {
								if (command === 'vibrate') {
									if (device.canOutput("Vibrate")) {
										device.vibrate(intensity);
										if (duration)
											setTimeout(() => device.stop(), duration);
									}
								} else if (command === 'stop') {
									device.stop();
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
