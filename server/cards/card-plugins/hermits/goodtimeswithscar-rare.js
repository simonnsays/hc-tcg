import HermitCard from './_hermit-card'
import {flipCoin, discardCard} from '../../../utils'

// - Game should not consume attached totem if deathloop is active
// - Golden Axe should not bypass deathloop (unlike a totem)
// - Needs to work for death by being attacked or by death by ailments
// TODO - Combination of flip&coin abilities & scar's ability will mean double coin flip for the attack.
// TODO - Scar's coin flip can also occur when he dies from fire/posion at end of a turn
class GoodTimesWithScarRareHermitCard extends HermitCard {
	constructor() {
		super({
			id: 'goodtimeswithscar_rare',
			name: 'Scar',
			rarity: 'rare',
			hermitType: 'builder',
			health: 270,
			primary: {
				name: 'Scarred For Life',
				cost: ['builder'],
				damage: 50,
				power: null,
			},
			secondary: {
				name: 'Deathloop',
				cost: ['builder', 'any'],
				damage: 70,
				power:
					'If Scar is knocked out the following turn, flip a coin.\n\nIf heads, Scar is revived with +50HP.\n\nCan only be revived once.',
			},
		})

		this.recoverAmount = 50
	}

	register(game) {
		// scar attacks
		game.hooks.attack.tap(this.id, (target, turnAction, derivedState) => {
			const {attackerHermitCard, typeAction, currentPlayer} = derivedState

			if (typeAction !== 'SECONDARY_ATTACK') return target
			if (!target.isActive) return target
			if (attackerHermitCard.cardId !== this.id) return target
			if (currentPlayer.custom[attackerHermitCard.cardInstance]) return target

			// Create coin flip beforehand to apply fortune if any
			const coinFlip = flipCoin(currentPlayer)
			currentPlayer.custom[attackerHermitCard.cardInstance] = coinFlip
			currentPlayer.custom[this.id] = attackerHermitCard.cardInstance

			return target
		})

		// next turn attack on scar
		game.hooks.attack.tap(this.id, (target, turnAction, derivedState) => {
			const {opponentPlayer} = derivedState
			if (target.row.hermitCard.cardId !== this.id) return target

			const instance = opponentPlayer.custom[this.id]
			if (!instance) return target
			const coinFlip = opponentPlayer.custom[instance]

			if (!coinFlip || coinFlip[0] === 'tails') return target

			target.recovery.push({amount: this.recoverAmount})
			return target
		})

		// After attack check if scar's ability was used
		game.hooks.attackResult.tap(this.id, (target, turnAction, derivedState) => {
			const {currentPlayer, opponentPlayer, attackerHermitCard} = derivedState
			if (target.row.hermitCard.cardId !== this.id) return target

			const instance = opponentPlayer.custom[this.id]
			if (!instance) return target
			const coinFlip = opponentPlayer.custom[instance]
			if (!coinFlip) return target
			if (!target.died && !target.revived) return target

			currentPlayer.coinFlips[this.id] = coinFlip
			if (!target.revived) delete opponentPlayer.custom[instance]
			delete opponentPlayer.custom[this.id]
		})

		// ailment death
		game.hooks.hermitDeath.tap(this.id, (recovery, deathInfo) => {
			const {playerState, row} = deathInfo
			if (row.hermitCard.cardId !== this.id) return
			const instance = playerState.custom[this.id]
			if (!instance) return
			const coinFlip = playerState.custom[instance]
			if (!coinFlip) return

			playerState.coinFlips[this.id] = coinFlip

			if (coinFlip[0] === 'heads') {
				recovery.push({amount: this.recoverAmount})
				delete playerState.custom[this.id]
			}
			delete playerState.custom[instance]
			return recovery
		})

		// If scar did not revive by his next turn delete the flag
		game.hooks.turnStart.tap(this.id, (derivedState) => {
			const {currentPlayer} = derivedState
			if (currentPlayer.custom[this.id]) {
				const instance = currentPlayer.custom[this.id]
				delete currentPlayer.custom[this.id]
				delete currentPlayer.custom[instance]
			}
		})

		// Power can be used only once. This resets it when the card is placed on board. (e.g. when picked from discarded)
		game.hooks.playCard
			.for('hermit')
			.tap(this.id, (turnAction, derivedState) => {
				const card = turnAction.payload?.card
				if (!card || card.cardId !== this.id) return
				const {currentPlayer} = derivedState
				delete currentPlayer.custom[card.cardInstance]
			})
	}
}

export default GoodTimesWithScarRareHermitCard
