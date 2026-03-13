# Workout CLI 🏋️‍♂️

A comprehensive, offline-first, scientific command-line interface for tracking workouts, logging rehabilitation progress, and managing multi-user fitness profiles.

Built with Node.js and powered by a swift, local SQLite database.

## Features ✨

*   **👥 Multi-User Profiles:** Independent profiles mean you can track your workouts, while sharing the same CLI with a workout partner or tracking a separate rehabilitation profile.
*   **📚 Global Exercise Library:** Add exercises once, and they are available across all profiles. Track muscle groups, exercise types, and equipment.
*   **⏱️ Active Session Management:** Start a workout, log sets in real-time, add specific metadata (like RIR or notes) to individual sets, undo mistakes, and mark the session done.
*   **📊 Scientific Progression Algorithm:** Instead of just showing raw numbers, the `progression` command calculates your Estimated 1-Rep Max (e1RM) and Total Volume Load over time. It uses Double Progression logic to give you an AI-driven recommendation for your next session.
*   **🩹 Injury Tracking & Safety:** Log injuries with specific severities (mild, moderate, severe) tied to body regions and affected exercises. The progression algorithm automatically detects relevant active injuries and overrides standard recommendations with safety protocols (e.g., "Reduce weight by 30-50%" or "STOP this exercise").
*   **🤖 Full JSON Support:** Every single command supports the `--json` flag, making this CLI perfectly suited for automation, scripting, or piping data into other tools.

## Installation 🚀

Make sure you have Node.js installed, then clone this repository and link it globally:

```bash
git clone <repository-url>
cd cli-workout-v1
npm install
npm link
```

The `workout` command is now available everywhere in your terminal. Database is automatically initialized at `~/.workout-cli.db`.

## Usage Guide 📖

By default, commands apply to the active profile (or require the `--profile` flag if multiple profiles exist).

### 1. Setup Profiles & Exercises
```bash
# Create user profiles
workout profile create mike
workout profile create sarah

# View profiles
workout profile list

# Add exercises to the global library (required before logging)
workout exercises add "Bench Press" --muscles chest,triceps,shoulders --type compound --equipment barbell
workout exercises add "Dumbbell RDL" --muscles hamstrings,glutes --type compound --equipment dumbbell

# View the exercise library
workout exercises list
```

### 2. Logging a Workout Session
The CLI tracks your *active* session state.

```bash
# Start a new blank workout session
workout --profile mike start --empty

# Log actual work sets (Weight, then Reps)
workout --profile mike log "Dumbbell RDL" 50 10
workout --profile mike log "Dumbbell RDL" 55 8,8,7

# Log a note for the specific exercise (Metadata only)
workout --profile mike note "Dumbbell RDL" "Felt a minor tweak on the last rep."

# Finish the workout session
workout --profile mike done
```

### 3. Managing Mistakes In-Session
Made a typo? No problem.

```bash
# Undo the very last set logged in the current session
workout --profile mike undo

# Undo the very last set for a specific exercise
workout --profile mike undo "Dumbbell RDL"

# Edit a specific set (e.g., Edit the 2nd set of Dumbbell RDL to 60kg for 8 reps)
workout --profile mike edit "Dumbbell RDL" 2 60 8

# Swap out an exercise entirely for the session
workout --profile mike swap "Dumbbell RDL" "Barbell RDL"

# Cancel the entire active session (wipes the session and all its sets)
workout --profile mike cancel
```

### 4. History, PRs & Scientific Progression
Analyze your historical data.

```bash
# View all Personal Records (Max Weight lifted) for the profile
workout --profile mike pr

# View details of the last completed workout
workout --profile mike last

# Scientifically analyze progression and get AI recommendations
workout --profile mike progression "Dumbbell RDL"
```

### 5. Managing Injuries 🩹
Track injuries to safely guide your progression recommendations.

```bash
# Log a new injury
workout --profile mike injury add "left knee" -s severe -d "ACL strain during squats" -e "squat,leg press,lunge" -n "Seeing physio weekly"

# View all active injuries
workout --profile mike injury list

# View all injuries including recovered ones
workout --profile mike injury list --all

# Update an injury's severity or notes
workout --profile mike injury update 1 -s moderate -n "swelling reduced"

# Mark an injury as recovered
workout --profile mike injury recover 1
```

### Scripting & JSON output
Add `--json` to *any* command to get structured, parseable output:
```bash
workout --profile mike pr --json
workout exercises list --json
```

## Testing 🧪
The project includes a robust test suite using Jest and an in-memory SQLite database to ensure the CLI remains stable.

```bash
npm test
```

## Contributing 🤝
Contributions are welcome! Please ensure that any new commands or features include corresponding unit/integration tests and support the `--json` output flag.
