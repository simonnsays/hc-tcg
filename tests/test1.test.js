import {jest} from '@jest/globals'
import {SyncWaterfallHook} from 'tapable'
import {createStore, applyMiddleware} from 'redux'
import createSagaMiddleware from 'redux-saga'

import gameSaga from '../server/routines/game.js'

const sagaMiddleware = createSagaMiddleware()
const store = createStore(() => {}, applyMiddleware(sagaMiddleware))

const createGame = (allPlayers) => {
	sagaMiddleware.run(gameSaga, allPlayers, Object.keys(allPlayers))
	const data = Object.values(allPlayers)[0].socket.emit.mock.calls[0][1]
	const gameState = data.payload.gameState

	return {
		allPlayers,
		state: gameState,
		player: gameState.players[gameState.turnPlayerId],
	}
}

const gameAction = (step, type, payload) => {
	store.dispatch({
		type,
		playerId: step.state.turnPlayerId,
		payload,
	})
	const socket = step.allPlayers[step.player.id].socket
	const newGameState =
		socket.emit.mock.calls[step.state.turn][1].payload.gameState
	return {
		allPlayers: step.allPlayers,
		state: newGameState,
		player: newGameState.players[newGameState.turnPlayerId],
	}
}

const gameRun = (step1, messages) => {
	return messages.reduce((step, msg) => gameAction(step, msg[0], msg[1]), step1)
}

const allPlayers = {
	player1: {
		playerId: 'player1',
		playerName: 'player1',
		socket: {
			emit: jest.fn(),
		},
		playerDeck: ['keralis_rare', 'item_terraform_rare'],
	},
	player2: {
		playerId: 'player2',
		playerName: 'player2',
		socket: {
			emit: jest.fn(),
		},
		playerDeck: ['keralis_rare', 'item_terraform_rare'],
	},
}

test('Place Keralis on board', () => {
	const step1 = createGame(allPlayers)
	const hand = step1.player.hand
	const keralisCard = hand.find(({cardId}) => cardId === 'keralis_rare')
	const itemCard = hand.find(({cardId}) => cardId === 'item_terraform_rare')
	// prettier-ignore
	const messages = [
		['PLAY_CARD', {card: keralisCard, rowHermitCard: null, rowIndex: 0, slotIndex: 3, slotType: 'hermit'}],
		['PLAY_CARD', {card: itemCard, rowHermitCard: keralisCard, rowIndex: 0, slotIndex: 0, slotType: 'item'}],
	]
	const lastStep = gameRun(step1, messages)
	const firstRow = lastStep.player.board.rows[0]
	expect(firstRow.hermitCard?.cardId).toBe('keralis_rare')
	expect(firstRow.itemCards[0]?.cardId).toBe('item_terraform_rare')
})
