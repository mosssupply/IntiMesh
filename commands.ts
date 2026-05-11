import {Device} from "@zendrex/buttplug.js";

const normalizePercentValue = (rawValue: string) => {
    const parsedValue = parseInt(rawValue) ?? 50;
    if (parsedValue >= 0 && parsedValue <= 100) {
        return parsedValue / 100;
    }
    // Default value
    return 0.5;
}

// convert seconds to ms
const normalizeDuration = (rawDuration: string) => {
    const parsedDuration = parseInt(rawDuration) ?? 1;
    if (parsedDuration >= 0) {
        return parsedDuration * 1000;
    }
    // Default value
    return 1;
}

export const stop = async (device: Device) => {
    await device.stop();
}

export const vibrate = async (device: Device, params: string[]) => {
    let intensity = 1;
    let duration: number;

    if (params[0]) {
        intensity = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Vibrate")) {
        await device.vibrate(intensity);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const oscillate = async (device: Device, params: string[]) => {
    let speed = 1;
    let duration: number;

    if (params[0]) {
        speed = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Oscillate")) {
        await device.oscillate(speed);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const constrict = async (device: Device, params: string[]) => {
    let pressure = 1;
    let duration: number;

    if (params[0]) {
        pressure = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Constrict")) {
        await device.constrict(pressure);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const spray = async (device: Device, params: string[]) => {
    let value = 1;
    let duration: number;

    if (params[0]) {
        value = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Spray")) {
        await device.spray(value);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const temperature = async (device: Device, params: string[]) => {
    let value = 1;
    let duration: number;

    if (params[0]) {
        value = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Temperature")) {
        await device.temperature(value);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const rotate = async (device: Device, params: string[]) => {
    let isClockwise = true;
    let speed = 1;
    let duration: number;

    if (params[0]) {
        speed = normalizePercentValue(params[0]);
    }
    if (params[1] && params[1] !== 'clockwise') {
        isClockwise = false;
    }

    if (params[2]) {
        duration = normalizeDuration(params[2]);
    }

    if (device.canOutput("RotateWithDirection")) {
        await device.rotate(speed, {clockwise: isClockwise});
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    } else if (device.canOutput("Rotate")) {
        await device.rotate(speed);
        if (duration) {
            setTimeout(async () => await device.stop(), duration);
        }
    }
}

export const position = async (device: Device, params: string[]) => {
    let value = 1;
    let duration: number;

    if (params[0]) {
        value = normalizePercentValue(params[0]);
    }
    if (params[1]) {
        duration = normalizeDuration(params[1]);
    }

    if (device.canOutput("Position")) {
        await device.position(value, {duration: duration});
    }
}