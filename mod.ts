import { Application, Context, Router, Status } from "https://deno.land/x/oak/mod.ts";
import args from 'https://deno.land/x/args@2.0.6/wrapper.ts';
import { EarlyExitFlag, PartialOption } from 'https://deno.land/x/args@2.0.6/flag-types.ts';
import { Integer, Text } from 'https://deno.land/x/args@2.0.6/value-types.ts';
import { PARSE_FAILURE } from 'https://deno.land/x/args@2.0.6/symbols.ts';

// write a simple argument parser with options for the port and a blacklist of IPs
const parser = args
    .describe("Run a simple webserver")
    .with(EarlyExitFlag("help", { alias: ["?", "h"],describe: "Show help", exit() {
        console.log("USAGE:");
        console.log("  deno --allow-net mod.ts [options]");
        console.log(parser.help());
        return Deno.exit(0);
    }}))
    .with(PartialOption("blacklist", {type: Text, alias: ["b"], describe: "A list of banned IPs that cannot access root separated by a comma", default: ""}))
    .with(PartialOption("port",{ type: Integer, alias: ['p'], describe: "Set the webserver port", default: 3000}));

// parse arguments
const runArgs = parser.parse(Deno.args);

// check if arguments where correct
if(runArgs.tag === PARSE_FAILURE) {
    console.error("Failed to parse CLI arguments");
    console.error(runArgs.error.toString());
    Deno.exit(1);
} else {
    const { port, blacklist } = runArgs.value;

    const bannedIPs = blacklist.split(",");

    // keep track of Visitors
    var visitors: any = {};

    // set up routes with their logic
    const router = new Router();
    router.get("/", (context) => {
        if(visitors[context.request.ip]) {
            visitors[context.request.ip]++;
        } else {
            visitors[context.request.ip] = 1;
        }
        context.response.body = (visitors[context.request.ip]===1)? "Hello World": "Hello Again. You have been here before " + (visitors[context.request.ip] - 1) + " times!";
    });
    router.get("/s", (context) => {
        context.response.body = context.request.ip;
    });

    // Create a 404 Not Found fallback
    const notFound = (context: Context) => {
        context.response.status = Status.NotFound;
        context.response.body = "404 - Not Found";
    }

    // create a blocker middleware to prevent access for blacklisted IPs
    const blocker = async (context: Context, next: () => Promise<void>) => {
        if(bannedIPs.includes(context.request.ip)) {
            // "redirect" to 404 not found
            notFound(context);
            return;
        } else {
            // continue normally
            await next();
        }
    }

    // start webserver with these routes
    const app = new Application();
    app.use(blocker);
    app.use(router.routes());
    app.use(router.allowedMethods());
    app.use(notFound);

    app.addEventListener("listen", ({ hostname, port, secure }) => {
        console.log("Started listening on: " + ((secure)?"https://":"http://") + "" + (hostname ?? "localhost") + ":" + port);
    });

    await app.listen({ port: Number(port) });
}

